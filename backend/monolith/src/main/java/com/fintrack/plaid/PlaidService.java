package com.fintrack.plaid;

import com.fasterxml.jackson.databind.JsonNode;
import com.fintrack.common.BadRequestException;
import com.fintrack.transactions.entity.Transaction;
import com.fintrack.transactions.repository.TransactionRepository;
import com.fintrack.transactions.service.CategoryRuleService;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Bank connections through Plaid: connect (Plaid Link → public token → access token),
 * then import transactions with /transactions/sync — added ones are created and
 * categorised from the user's own history, modified ones updated (keeping the
 * user's category), removed ones deleted. Synced every 6 hours and on demand.
 */
@Service
@Slf4j
public class PlaidService {

    static final String EXTERNAL_PREFIX = "plaid:";
    private static final int MAX_PAGES = 40;

    private final PlaidConfig config;
    private final PlaidClient plaid;
    private final TokenCipher cipher;
    private final PlaidItemRepository items;
    private final TransactionRepository transactions;
    private final CategoryRuleService categories;
    private final String webhookUrl;

    private final com.fintrack.auth.repository.UserRepository users;
    private final PlaidAccountRepository accounts;
    private final com.fintrack.investments.HoldingRepository holdings;

    public PlaidService(PlaidConfig config, PlaidClient plaid, TokenCipher cipher, PlaidItemRepository items,
                        TransactionRepository transactions, CategoryRuleService categories,
                        @Value("${plaid.webhook-url:}") String webhookUrl,
                        com.fintrack.auth.repository.UserRepository users,
                        PlaidAccountRepository accounts,
                        com.fintrack.investments.HoldingRepository holdings) {
        this.users = users;
        this.accounts = accounts;
        this.holdings = holdings;
        this.config = config;
        this.plaid = plaid;
        this.cipher = cipher;
        this.items = items;
        this.transactions = transactions;
        this.categories = categories;
        this.webhookUrl = webhookUrl;
    }

    public record ItemView(UUID id, String institutionName, String status, String lastError, LocalDateTime lastSyncedAt) {}
    public record SyncResult(int added, int modified, int removed) {}

    public boolean enabled() { return config.isEnabled(); }

    /** "production", "sandbox" (test banks) or null (not available), for this user. */
    public String modeName(String userId) {
        PlaidConfig.Mode m = config.modeFor(emailOf(userId));
        return m == null ? null : m.env();
    }

    private String emailOf(String userId) {
        try {
            return users.findById(UUID.fromString(userId)).map(u -> u.getEmail()).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    private PlaidConfig.Mode modeForUser(String userId) {
        requireEnabled();
        PlaidConfig.Mode m = config.modeFor(emailOf(userId));
        if (m == null) throw new BadRequestException("Bank connections aren't available for this account");
        return m;
    }

    public String linkToken(String userId) {
        return plaid.createLinkToken(modeForUser(userId), userId, webhookUrl);
    }

    /** Stores the connection and imports its transactions. */
    public SyncResult connect(String userId, String publicToken, String institutionName) {
        PlaidConfig.Mode mode = modeForUser(userId);
        if (publicToken == null || publicToken.isBlank()) throw new BadRequestException("publicToken is required");
        String[] tokens = plaid.exchangePublicToken(mode, publicToken);
        PlaidItem item = new PlaidItem();
        item.setUserId(userId);
        item.setEnvironment(mode.env()); // later syncs must go to the same Plaid environment
        item.setItemId(tokens[1]);
        item.setAccessTokenEnc(cipher.encrypt(tokens[0]));
        item.setInstitutionName(institutionName == null || institutionName.isBlank() ? "Bank" : institutionName.trim());
        item.setCreatedAt(LocalDateTime.now());
        items.save(item);
        log.info("Bank connected for user {} ({})", userId, item.getInstitutionName());
        return sync(item);
    }

    public List<ItemView> list(String userId) {
        return items.findByUserId(userId).stream()
                .map(i -> new ItemView(i.getId(), i.getInstitutionName(), i.getStatus().name(), i.getLastError(), i.getLastSyncedAt()))
                .toList();
    }

    public SyncResult syncNow(String userId, UUID id) {
        requireEnabled();
        return sync(items.findByIdAndUserId(id, userId).orElseThrow(() -> new BadRequestException("Bank connection not found")));
    }

    /** Stops syncing and tells Plaid to drop the connection; imported transactions stay. */
    public void disconnect(String userId, UUID id) {
        PlaidItem item = items.findByIdAndUserId(id, userId).orElseThrow(() -> new BadRequestException("Bank connection not found"));
        try {
            PlaidConfig.Mode mode = config.modeNamed(item.getEnvironment());
            if (mode != null) plaid.removeItem(mode, cipher.decrypt(item.getAccessTokenEnc()));
        } catch (Exception e) {
            log.warn("Plaid item/remove failed for {}: {}", item.getId(), e.getMessage()); // still forget it here
        }
        items.delete(item);
    }

    /** For account deletion. */
    public void deleteAllForUser(String userId) {
        for (PlaidItem i : items.findByUserId(userId)) {
            try { disconnect(userId, i.getId()); } catch (Exception e) { items.delete(i); }
        }
    }

    @Scheduled(fixedDelay = 6 * 3600_000L, initialDelay = 10 * 60_000L)
    @SchedulerLock(name = "plaidSync", lockAtMostFor = "PT1H", lockAtLeastFor = "PT1M")
    public void syncAll() {
        syncAllNow();
    }

    public int syncAllNow() {
        if (!config.isEnabled()) return 0;
        int n = 0;
        for (PlaidItem i : items.findAll()) {
            if (i.getStatus() == PlaidItem.Status.LOGIN_REQUIRED) continue; // the user must reconnect
            sync(i);
            n++;
        }
        return n;
    }

    SyncResult sync(PlaidItem item) {
        PlaidConfig.Mode mode = config.modeNamed(item.getEnvironment());
        if (mode == null) {
            // e.g. a test-bank connection after PLAID_SANDBOX_SECRET was removed
            item.setStatus(PlaidItem.Status.ERROR);
            item.setLastError("This connection's Plaid mode (" + item.getEnvironment() + ") isn't set up on the server");
            items.save(item);
            return new SyncResult(0, 0, 0);
        }
        String accessToken = cipher.decrypt(item.getAccessTokenEnc());
        String cursor = item.getSyncCursor();
        int added = 0, modified = 0, removed = 0;
        try {
            for (int page = 0; page < MAX_PAGES; page++) {
                JsonNode r = plaid.transactionsSync(mode, accessToken, cursor);
                for (JsonNode t : r.path("added")) if (upsert(item.getUserId(), t, true)) added++;
                for (JsonNode t : r.path("modified")) if (upsert(item.getUserId(), t, false)) modified++;
                for (JsonNode t : r.path("removed")) {
                    var existing = transactions.findByUserIdAndExternalId(item.getUserId(), EXTERNAL_PREFIX + t.path("transaction_id").asText());
                    if (existing.isPresent()) { transactions.delete(existing.get()); removed++; }
                }
                cursor = r.path("next_cursor").asText(cursor);
                if (!r.path("has_more").asBoolean(false)) break;
            }
            item.setSyncCursor(cursor);
            refreshBalancesAndHoldings(item, mode, accessToken);
            item.setStatus(PlaidItem.Status.OK);
            item.setLastError(null);
            item.setLastSyncedAt(LocalDateTime.now());
        } catch (PlaidClient.PlaidException e) {
            boolean login = "ITEM_LOGIN_REQUIRED".equals(e.code());
            item.setStatus(login ? PlaidItem.Status.LOGIN_REQUIRED : PlaidItem.Status.ERROR);
            item.setLastError(login ? "The bank needs you to sign in again: disconnect and reconnect it." : truncate(e.getMessage()));
            log.warn("Plaid sync for item {} failed: {} {}", item.getId(), e.code(), e.getMessage());
        }
        items.save(item);
        return new SyncResult(added, modified, removed);
    }

    /**
     * Account balances (for net worth) and, for brokerages, holdings. Best effort: a bank
     * without investments, or a failed call, never fails the transaction sync.
     */
    void refreshBalancesAndHoldings(PlaidItem item, PlaidConfig.Mode mode, String accessToken) {
        java.util.Map<String, String> accountNames = new java.util.HashMap<>();
        try {
            for (JsonNode a : plaid.accounts(mode, accessToken).path("accounts")) {
                String accountId = a.path("account_id").asText();
                PlaidAccount acc = accounts.findByPlaidItemIdAndAccountId(item.getId(), accountId).orElseGet(PlaidAccount::new);
                acc.setUserId(item.getUserId());
                acc.setPlaidItemId(item.getId());
                acc.setAccountId(accountId);
                acc.setName(truncate(a.path("official_name").asText(a.path("name").asText("Account"))));
                if (a.hasNonNull("name")) acc.setName(truncate(a.path("name").asText()));
                acc.setMask(a.path("mask").asText(null));
                acc.setType(a.path("type").asText(null));
                acc.setSubtype(a.path("subtype").asText(null));
                JsonNode bal = a.path("balances");
                acc.setCurrentBalance(bal.hasNonNull("current") ? new BigDecimal(bal.path("current").asText()) : null);
                acc.setCurrency(bal.path("iso_currency_code").asText("USD"));
                acc.setUpdatedAt(LocalDateTime.now());
                accounts.save(acc);
                accountNames.put(accountId, acc.getName() + (acc.getMask() != null ? " ••" + acc.getMask() : ""));
            }
        } catch (Exception e) {
            log.warn("Plaid balances for item {} failed: {}", item.getId(), e.getMessage());
        }
        if (!accountNames.isEmpty() && accounts.findByUserId(item.getUserId()).stream()
                .noneMatch(a -> item.getId().equals(a.getPlaidItemId()) && "investment".equals(a.getType()))) {
            return; // no brokerage accounts here, so no holdings to ask for
        }
        try {
            importHoldings(item, plaid.investmentHoldings(mode, accessToken), accountNames);
        } catch (PlaidClient.PlaidException e) {
            log.info("No holdings for item {}: {}", item.getId(), e.code()); // e.g. PRODUCTS_NOT_SUPPORTED
        } catch (Exception e) {
            log.warn("Plaid holdings for item {} failed: {}", item.getId(), e.getMessage());
        }
    }

    void importHoldings(PlaidItem item, JsonNode r, java.util.Map<String, String> accountNames) {
        java.util.Map<String, JsonNode> securities = new java.util.HashMap<>();
        for (JsonNode s : r.path("securities")) securities.put(s.path("security_id").asText(), s);
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (JsonNode h : r.path("holdings")) {
            JsonNode sec = securities.getOrDefault(h.path("security_id").asText(), com.fasterxml.jackson.databind.node.MissingNode.getInstance());
            String externalId = "plaid:" + h.path("account_id").asText() + ":" + h.path("security_id").asText();
            seen.add(externalId);
            com.fintrack.investments.Holding hold = holdings.findByUserIdAndExternalId(item.getUserId(), externalId)
                    .orElseGet(com.fintrack.investments.Holding::new);
            if (hold.getId() == null) {
                hold.setUserId(item.getUserId());
                hold.setExternalId(externalId);
                hold.setCreatedAt(LocalDateTime.now());
            }
            hold.setSource(com.fintrack.investments.Holding.Source.PLAID);
            hold.setPlaidItemId(item.getId());
            String ticker = sec.hasNonNull("ticker_symbol") ? sec.path("ticker_symbol").asText() : null;
            hold.setSymbol(ticker != null && ticker.length() <= 20 ? ticker : null);
            hold.setName(truncate(sec.path("name").asText(ticker != null ? ticker : "Holding")));
            hold.setAssetType(assetType(sec.path("type").asText("")));
            hold.setQuantity(new BigDecimal(h.path("quantity").asText("0")));
            hold.setCostBasis(h.hasNonNull("cost_basis") ? new BigDecimal(h.path("cost_basis").asText()).setScale(2, java.math.RoundingMode.HALF_UP) : null);
            hold.setLastPrice(h.hasNonNull("institution_price") ? new BigDecimal(h.path("institution_price").asText()) : null);
            hold.setPriceUpdatedAt(LocalDateTime.now());
            hold.setAccountName(truncate(accountNames.getOrDefault(h.path("account_id").asText(), item.getInstitutionName())));
            hold.setUpdatedAt(LocalDateTime.now());
            holdings.save(hold);
        }
        // sold since the last sync
        for (com.fintrack.investments.Holding old : holdings.findByPlaidItemId(item.getId())) {
            if (!seen.contains(old.getExternalId())) holdings.delete(old);
        }
    }

    static com.fintrack.investments.Holding.AssetType assetType(String plaidType) {
        return switch (plaidType) {
            case "equity" -> com.fintrack.investments.Holding.AssetType.STOCK;
            case "etf" -> com.fintrack.investments.Holding.AssetType.ETF;
            case "mutual fund" -> com.fintrack.investments.Holding.AssetType.FUND;
            case "cryptocurrency" -> com.fintrack.investments.Holding.AssetType.CRYPTO;
            case "fixed income" -> com.fintrack.investments.Holding.AssetType.BOND;
            case "cash" -> com.fintrack.investments.Holding.AssetType.CASH;
            default -> com.fintrack.investments.Holding.AssetType.OTHER;
        };
    }

    /** Creates (added) or updates (modified) the transaction. Returns true if something was written. */
    private boolean upsert(String userId, JsonNode t, boolean isNew) {
        String externalId = EXTERNAL_PREFIX + t.path("transaction_id").asText();
        BigDecimal plaidAmount = new BigDecimal(t.path("amount").asText("0")); // Plaid: positive = money out
        String type = plaidAmount.signum() >= 0 ? "EXPENSE" : "INCOME";
        BigDecimal amount = plaidAmount.abs();
        String name = t.path("name").asText("Transaction");
        String merchant = t.hasNonNull("merchant_name") ? t.path("merchant_name").asText() : name;
        LocalDate date = LocalDate.parse(t.path("date").asText());
        String status = t.path("pending").asBoolean(false) ? "pending" : "completed";

        var existing = transactions.findByUserIdAndExternalId(userId, externalId);
        Transaction tx;
        if (existing.isPresent()) {
            tx = existing.get(); // keep the user's category, notes and tags
        } else {
            tx = new Transaction();
            tx.setUserId(userId);
            tx.setExternalId(externalId);
            tx.setCreatedAt(LocalDateTime.now());
            tx.setCategory(categories.suggest(userId, merchant, name, amount, type));
        }
        tx.setDescription(truncate(name));
        tx.setMerchant(truncate(merchant));
        tx.setAmount(amount);
        tx.setType(type);
        tx.setDate(date);
        tx.setStatus(status);
        tx.setUpdatedAt(LocalDateTime.now());
        transactions.save(tx);
        return true;
    }

    private void requireEnabled() {
        if (!config.isEnabled()) throw new BadRequestException("Bank connections aren't set up on this server");
    }

    private static String truncate(String s) {
        return s == null ? null : s.length() > 255 ? s.substring(0, 255) : s;
    }
}
