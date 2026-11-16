package com.fintrack.investments;

import com.fintrack.common.BadRequestException;
import com.fintrack.plaid.PlaidAccount;
import com.fintrack.plaid.PlaidAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Holdings (hand-entered and imported) and the linked-account side of net worth. */
@Service
@RequiredArgsConstructor
public class InvestmentService {

    private final HoldingRepository holdings;
    private final PlaidAccountRepository accounts;
    private final QuoteService quotes;

    public record HoldingRequest(String symbol, String name, String assetType, BigDecimal quantity,
                                 BigDecimal costBasis, BigDecimal price, String accountName) {}

    public record HoldingView(UUID id, String symbol, String name, String assetType, BigDecimal quantity,
                              BigDecimal costBasis, BigDecimal price, BigDecimal value, BigDecimal gain,
                              Double gainPct, String source, String accountName, LocalDateTime priceUpdatedAt) {}

    public record Portfolio(List<HoldingView> holdings, BigDecimal totalValue, BigDecimal totalCost,
                            BigDecimal totalGain, Double totalGainPct) {}

    public record LinkedAccount(String name, String mask, String type, String subtype, BigDecimal balance,
                                boolean liability) {}

    /** What connected banks and investments add to net worth. */
    public record LinkedNetWorth(List<LinkedAccount> accounts, BigDecimal investments, BigDecimal assets,
                                 BigDecimal liabilities) {}

    // ── holdings ──────────────────────────────────────────────────────────────

    public Portfolio portfolio(String userId) {
        List<Holding> list = holdings.findByUserIdOrderByNameAsc(userId);
        refreshPrices(list);
        List<HoldingView> views = list.stream().map(InvestmentService::view).toList();
        BigDecimal value = sum(views.stream().map(HoldingView::value).toList());
        BigDecimal cost = sum(views.stream().filter(v -> v.costBasis() != null).map(HoldingView::costBasis).toList());
        BigDecimal valueWithCost = sum(views.stream().filter(v -> v.costBasis() != null).map(HoldingView::value).toList());
        BigDecimal gain = valueWithCost.subtract(cost);
        return new Portfolio(views, value, cost, gain, pct(gain, cost));
    }

    public HoldingView create(String userId, HoldingRequest r) {
        Holding h = new Holding();
        h.setUserId(userId);
        h.setSource(Holding.Source.MANUAL);
        h.setCreatedAt(LocalDateTime.now());
        apply(h, r);
        return view(holdings.save(h));
    }

    public HoldingView update(String userId, UUID id, HoldingRequest r) {
        Holding h = holdings.findByIdAndUserId(id, userId).orElseThrow(() -> new BadRequestException("Holding not found"));
        if (h.getSource() == Holding.Source.PLAID) throw new BadRequestException("Imported holdings update from your brokerage");
        apply(h, r);
        return view(holdings.save(h));
    }

    public void delete(String userId, UUID id) {
        Holding h = holdings.findByIdAndUserId(id, userId).orElseThrow(() -> new BadRequestException("Holding not found"));
        if (h.getSource() == Holding.Source.PLAID) throw new BadRequestException("Disconnect the brokerage to remove imported holdings");
        holdings.delete(h);
    }

    public QuoteService.Quote lookup(String symbol, String assetType) {
        return quotes.quote(symbol, type(assetType));
    }

    private void apply(Holding h, HoldingRequest r) {
        Holding.AssetType type = type(r.assetType());
        String symbol = r.symbol() == null || r.symbol().isBlank() ? null : r.symbol().trim().toUpperCase();
        if (r.quantity() == null || r.quantity().signum() <= 0) throw new BadRequestException("Enter how many you own");
        if (r.costBasis() != null && r.costBasis().signum() < 0) throw new BadRequestException("Amount paid can't be negative");
        if (symbol != null && symbol.length() > 20) throw new BadRequestException("Symbol is too long");
        QuoteService.Quote q = symbol != null ? quotes.quote(symbol, type) : null;
        String name = r.name() != null && !r.name().isBlank() ? r.name().trim() : q != null ? q.name() : symbol;
        if (name == null || name.isBlank()) throw new BadRequestException("Enter a symbol or a name");
        h.setSymbol(symbol);
        h.setName(name.length() > 255 ? name.substring(0, 255) : name);
        h.setAssetType(type);
        h.setQuantity(r.quantity());
        h.setCostBasis(r.costBasis());
        h.setAccountName(r.accountName() == null || r.accountName().isBlank() ? null : r.accountName().trim());
        if (q != null) {
            h.setLastPrice(q.price());
            h.setPriceUpdatedAt(LocalDateTime.now());
        } else if (r.price() != null && r.price().signum() >= 0) {
            // no market price (e.g. a private fund): use the price the user gave
            h.setLastPrice(r.price());
            h.setPriceUpdatedAt(LocalDateTime.now());
        } else if (symbol != null && h.getLastPrice() == null) {
            throw new BadRequestException("Couldn't find a price for " + symbol + ". Check the symbol, or enter the current price.");
        }
        h.setUpdatedAt(LocalDateTime.now());
    }

    /** Hand-entered holdings with a symbol get a fresh market price (cached for 15 minutes). */
    private void refreshPrices(List<Holding> list) {
        for (Holding h : list) {
            if (h.getSource() != Holding.Source.MANUAL || h.getSymbol() == null) continue;
            if (h.getPriceUpdatedAt() != null && h.getPriceUpdatedAt().isAfter(LocalDateTime.now().minusMinutes(15))) continue;
            QuoteService.Quote q = quotes.quote(h.getSymbol(), h.getAssetType());
            if (q == null) continue;
            h.setLastPrice(q.price());
            h.setPriceUpdatedAt(LocalDateTime.now());
            holdings.save(h);
        }
    }

    static HoldingView view(Holding h) {
        BigDecimal price = h.getLastPrice();
        BigDecimal value = price == null ? BigDecimal.ZERO : price.multiply(h.getQuantity()).setScale(2, RoundingMode.HALF_UP);
        BigDecimal gain = h.getCostBasis() == null || price == null ? null : value.subtract(h.getCostBasis());
        return new HoldingView(h.getId(), h.getSymbol(), h.getName(), h.getAssetType().name(), h.getQuantity(),
                h.getCostBasis(), price, value, gain, gain == null ? null : pct(gain, h.getCostBasis()),
                h.getSource().name(), h.getAccountName(), h.getPriceUpdatedAt());
    }

    // ── value over time ───────────────────────────────────────────────────────

    public record ValuePoint(java.time.LocalDate date, BigDecimal value) {}
    public record History(List<ValuePoint> points, BigDecimal change, Double changePct) {}

    /**
     * What today's holdings were worth on each day of the range ("1m", "6m" or "1y"):
     * each holding's quantity times that day's closing price. Days a market was closed
     * carry the last close forward; holdings without a market price stay at today's value.
     */
    public History history(String userId, String range) {
        List<Holding> list = holdings.findByUserIdOrderByNameAsc(userId);
        java.util.TreeSet<java.time.LocalDate> dates = new java.util.TreeSet<>();
        java.util.Map<Holding, java.util.TreeMap<java.time.LocalDate, BigDecimal>> prices = new java.util.LinkedHashMap<>();
        BigDecimal flat = BigDecimal.ZERO; // holdings with no price history
        for (Holding h : list) {
            List<QuoteService.PricePoint> pts = h.getSymbol() == null ? List.of() : quotes.history(h.getSymbol(), h.getAssetType(), range);
            if (pts.size() < 2) {
                if (h.getLastPrice() != null) flat = flat.add(h.getLastPrice().multiply(h.getQuantity()));
                continue;
            }
            java.util.TreeMap<java.time.LocalDate, BigDecimal> m = new java.util.TreeMap<>();
            for (QuoteService.PricePoint p : pts) { m.put(p.date(), p.close()); dates.add(p.date()); }
            prices.put(h, m);
        }
        List<ValuePoint> out = new ArrayList<>();
        for (java.time.LocalDate d : dates) {
            BigDecimal total = flat;
            for (var e : prices.entrySet()) {
                var at = e.getValue().floorEntry(d);            // last close on or before this day
                if (at == null) at = e.getValue().firstEntry(); // listed later than the others: use its first price
                total = total.add(at.getValue().multiply(e.getKey().getQuantity()));
            }
            out.add(new ValuePoint(d, total.setScale(2, RoundingMode.HALF_UP)));
        }
        if (out.size() < 2) return new History(out, null, null);
        BigDecimal change = out.get(out.size() - 1).value().subtract(out.get(0).value());
        return new History(out, change, pct(change, out.get(0).value()));
    }

    // ── net worth from connected accounts ─────────────────────────────────────

    public LinkedNetWorth linkedNetWorth(String userId) {
        List<LinkedAccount> list = new ArrayList<>();
        BigDecimal assets = BigDecimal.ZERO, liabilities = BigDecimal.ZERO;
        for (PlaidAccount a : accounts.findByUserId(userId)) {
            // investment accounts are counted through their holdings, so they're not added twice
            if ("investment".equals(a.getType()) || a.getCurrentBalance() == null) continue;
            BigDecimal bal = a.getCurrentBalance().abs();
            list.add(new LinkedAccount(a.getName(), a.getMask(), a.getType(), a.getSubtype(), bal, a.isLiability()));
            if (a.isLiability()) liabilities = liabilities.add(bal); else assets = assets.add(bal);
        }
        BigDecimal invested = portfolio(userId).totalValue();
        return new LinkedNetWorth(list, invested, assets.add(invested), liabilities);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    static Holding.AssetType type(String s) {
        try {
            return s == null ? Holding.AssetType.STOCK : Holding.AssetType.valueOf(s.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Unknown asset type: " + s);
        }
    }

    private static BigDecimal sum(List<BigDecimal> xs) {
        return xs.stream().filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static Double pct(BigDecimal gain, BigDecimal cost) {
        if (gain == null || cost == null || cost.signum() == 0) return null;
        return gain.multiply(BigDecimal.valueOf(100)).divide(cost, 2, RoundingMode.HALF_UP).doubleValue();
    }
}
