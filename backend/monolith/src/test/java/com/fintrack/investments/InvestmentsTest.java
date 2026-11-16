package com.fintrack.investments;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fintrack.plaid.PlaidAccount;
import com.fintrack.plaid.PlaidAccountRepository;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;

import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@DisplayName("Investments and linked net worth")
class InvestmentsTest {

    private HttpServer fakeQuotes;
    private QuoteService quotes;
    private final AtomicInteger calls = new AtomicInteger();

    @BeforeEach
    void start() throws Exception {
        fakeQuotes = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        fakeQuotes.createContext("/v8/finance/chart/", ex -> {
            calls.incrementAndGet();
            String sym = ex.getRequestURI().getPath().replace("/v8/finance/chart/", "");
            String body = switch (sym) {
                case "AAPL" -> "{\"chart\":{\"result\":[{\"meta\":{\"regularMarketPrice\":200.5,\"currency\":\"USD\",\"longName\":\"Apple Inc.\"},"
                        + "\"timestamp\":[1793836800,1793923200,1794182400],\"indicators\":{\"quote\":[{\"close\":[100,null,110]}]}}]}}";
                case "BTC-USD" -> "{\"chart\":{\"result\":[{\"meta\":{\"regularMarketPrice\":65000,\"currency\":\"USD\",\"shortName\":\"Bitcoin USD\"},"
                        + "\"timestamp\":[1793836800,1794009600,1794182400],\"indicators\":{\"quote\":[{\"close\":[60000,62000,65000]}]}}]}}";
                default -> "{\"chart\":{\"result\":null,\"error\":{\"code\":\"Not Found\"}}}";
            };
            byte[] b = body.getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(200, b.length);
            ex.getResponseBody().write(b);
            ex.close();
        });
        fakeQuotes.start();
        quotes = new QuoteService(new ObjectMapper(), "http://127.0.0.1:" + fakeQuotes.getAddress().getPort());
    }

    @AfterEach
    void stop() { fakeQuotes.stop(0); }

    @Test
    @DisplayName("quotes: stocks and crypto, cached, unknown symbols give null")
    void quoteLookup() {
        QuoteService.Quote apple = quotes.quote("aapl", Holding.AssetType.STOCK);
        assertThat(apple.price()).isEqualByComparingTo("200.5");
        assertThat(apple.name()).isEqualTo("Apple Inc.");
        quotes.quote("AAPL", Holding.AssetType.STOCK);
        assertThat(calls.get()).isEqualTo(1); // second lookup came from the cache
        assertThat(quotes.quote("BTC", Holding.AssetType.CRYPTO).price()).isEqualByComparingTo("65000");
        assertThat(quotes.quote("NOPE", Holding.AssetType.STOCK)).isNull();
        assertThat(QuoteService.marketSymbol("bad symbol!", Holding.AssetType.STOCK)).isNull();
    }

    @Test
    @DisplayName("adding a holding prices it from the market and works out value and gain")
    void addHolding() {
        HoldingRepository repo = mock(HoldingRepository.class);
        when(repo.save(any())).thenAnswer(i -> i.getArgument(0));
        InvestmentService svc = new InvestmentService(repo, mock(PlaidAccountRepository.class), quotes);

        var v = svc.create("u1", new InvestmentService.HoldingRequest("aapl", null, "STOCK",
                new BigDecimal("10"), new BigDecimal("1500"), null, "Robinhood"));
        assertThat(v.name()).isEqualTo("Apple Inc.");
        assertThat(v.value()).isEqualByComparingTo("2005.00");
        assertThat(v.gain()).isEqualByComparingTo("505.00");
        assertThat(v.gainPct()).isEqualTo(33.67);

        // no market price: the user's own price is used
        var house = svc.create("u1", new InvestmentService.HoldingRequest(null, "Private fund", "FUND",
                new BigDecimal("2"), null, new BigDecimal("1000"), null));
        assertThat(house.value()).isEqualByComparingTo("2000.00");

        assertThatThrownBy(() -> svc.create("u1", new InvestmentService.HoldingRequest("NOPE", null, "STOCK",
                BigDecimal.ONE, null, null, null))).hasMessageContaining("Couldn't find a price");
        assertThatThrownBy(() -> svc.create("u1", new InvestmentService.HoldingRequest("AAPL", null, "STOCK",
                BigDecimal.ZERO, null, null, null))).hasMessageContaining("how many");
    }

    @Test
    @DisplayName("net worth from linked accounts: cash and investments are assets, cards and loans owed")
    void linkedNetWorth() {
        HoldingRepository repo = mock(HoldingRepository.class);
        Holding h = new Holding();
        h.setName("Index fund"); h.setAssetType(Holding.AssetType.ETF); h.setQuantity(new BigDecimal("4"));
        h.setLastPrice(new BigDecimal("500")); h.setSource(Holding.Source.PLAID); h.setPriceUpdatedAt(LocalDateTime.now());
        when(repo.findByUserIdOrderByNameAsc("u1")).thenReturn(List.of(h));
        PlaidAccountRepository accts = mock(PlaidAccountRepository.class);
        when(accts.findByUserId("u1")).thenReturn(List.of(
                acct("Checking", "depository", "1200"), acct("Visa", "credit", "300"),
                acct("Student loan", "loan", "-9000"), acct("Brokerage", "investment", "2000")));

        var nw = new InvestmentService(repo, accts, quotes).linkedNetWorth("u1");
        assertThat(nw.investments()).isEqualByComparingTo("2000.00");
        assertThat(nw.assets()).isEqualByComparingTo("3200.00");      // checking + holdings (brokerage not counted twice)
        assertThat(nw.liabilities()).isEqualByComparingTo("9300.00");
        assertThat(nw.accounts()).hasSize(3);
    }

    @Test
    @DisplayName("value over time: quantity x each day's close, closed days carried forward, unpriced holdings flat")
    void valueOverTime() {
        HoldingRepository repo = mock(HoldingRepository.class);
        Holding aapl = holding("AAPL", Holding.AssetType.STOCK, "10", "200.5");
        Holding btc = holding("BTC", Holding.AssetType.CRYPTO, "0.1", "65000");
        Holding plan = holding(null, Holding.AssetType.OTHER, "2", "1000"); // no market price
        when(repo.findByUserIdOrderByNameAsc("u1")).thenReturn(List.of(aapl, btc, plan));

        var h = new InvestmentService(repo, mock(PlaidAccountRepository.class), quotes).history("u1", "1m");
        // days: Nov 5 (both), Nov 7 (BTC only: AAPL carries 100), Nov 9 (both)
        assertThat(h.points()).extracting(p -> p.value().toPlainString())
                .containsExactly("9000.00", "9200.00", "9600.00"); // 10*100+0.1*60000+2000, then +200, then 10*110+6500+2000
        assertThat(h.change()).isEqualByComparingTo("600.00");
        assertThat(h.changePct()).isEqualTo(6.67);

        when(repo.findByUserIdOrderByNameAsc("u2")).thenReturn(List.of(plan));
        assertThat(new InvestmentService(repo, mock(PlaidAccountRepository.class), quotes).history("u2", "1m").points()).isEmpty();
    }

    private static Holding holding(String symbol, Holding.AssetType type, String qty, String price) {
        Holding h = new Holding();
        h.setSymbol(symbol); h.setName(symbol == null ? "Plan" : symbol); h.setAssetType(type);
        h.setQuantity(new BigDecimal(qty)); h.setLastPrice(new BigDecimal(price));
        h.setSource(Holding.Source.MANUAL); h.setPriceUpdatedAt(LocalDateTime.now());
        return h;
    }

    private static PlaidAccount acct(String name, String type, String balance) {
        PlaidAccount a = new PlaidAccount();
        a.setName(name); a.setType(type); a.setCurrentBalance(new BigDecimal(balance));
        return a;
    }
}
