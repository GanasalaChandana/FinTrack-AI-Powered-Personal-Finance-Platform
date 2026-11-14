package com.fintrack.plaid;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fintrack.investments.Holding;
import com.fintrack.investments.HoldingRepository;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;

import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Balances and holdings imported from a (fake) Plaid during a sync. */
@DisplayName("Plaid balances and holdings import")
class PlaidHoldingsTest {

    private HttpServer fakePlaid;
    private PlaidService service;
    private final List<PlaidAccount> savedAccounts = new ArrayList<>();
    private final Map<String, Holding> savedHoldings = new LinkedHashMap<>();
    private final List<Holding> deleted = new ArrayList<>();
    private PlaidItem item;

    private void respond(String path, String json) {
        fakePlaid.createContext(path, ex -> {
            ex.getRequestBody().readAllBytes();
            byte[] b = json.getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(200, b.length);
            ex.getResponseBody().write(b);
            ex.close();
        });
    }

    @BeforeEach
    void start() throws Exception {
        fakePlaid = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        respond("/accounts/get", """
            {"accounts":[
              {"account_id":"chk","name":"Plaid Checking","mask":"0000","type":"depository","subtype":"checking","balances":{"current":110.5,"iso_currency_code":"USD"}},
              {"account_id":"cc","name":"Plaid Credit Card","mask":"3333","type":"credit","subtype":"credit card","balances":{"current":410,"iso_currency_code":"USD"}},
              {"account_id":"ira","name":"Plaid IRA","mask":"5555","type":"investment","subtype":"ira","balances":{"current":320.76,"iso_currency_code":"USD"}}]}""");
        respond("/investments/holdings/get", """
            {"holdings":[
              {"account_id":"ira","security_id":"s1","quantity":10,"institution_price":25.5,"cost_basis":200},
              {"account_id":"ira","security_id":"s2","quantity":0.5,"institution_price":40000,"cost_basis":null}],
             "securities":[
              {"security_id":"s1","name":"Vanguard Total Stock","ticker_symbol":"VTI","type":"etf"},
              {"security_id":"s2","name":"Bitcoin","ticker_symbol":"BTC","type":"cryptocurrency"}]}""");
        fakePlaid.start();
        String url = "http://127.0.0.1:" + fakePlaid.getAddress().getPort();
        PlaidConfig config = new PlaidConfig("client", "secret", "sandbox", url, "", "");

        PlaidAccountRepository accounts = mock(PlaidAccountRepository.class);
        when(accounts.findByPlaidItemIdAndAccountId(any(), anyString())).thenReturn(Optional.empty());
        when(accounts.save(any())).thenAnswer(i -> { PlaidAccount a = i.getArgument(0); savedAccounts.add(a); return a; });
        when(accounts.findByUserId("u1")).thenAnswer(i -> savedAccounts);

        HoldingRepository holdings = mock(HoldingRepository.class);
        Holding sold = new Holding();
        sold.setExternalId("plaid:ira:old");
        when(holdings.findByUserIdAndExternalId(eq("u1"), anyString())).thenReturn(Optional.empty());
        when(holdings.save(any())).thenAnswer(i -> { Holding h = i.getArgument(0); savedHoldings.put(h.getExternalId(), h); return h; });
        when(holdings.findByPlaidItemId(any())).thenAnswer(i -> { List<Holding> l = new ArrayList<>(savedHoldings.values()); l.add(sold); return l; });
        doAnswer(i -> { deleted.add(i.getArgument(0)); return null; }).when(holdings).delete(any());

        service = new PlaidService(config, new PlaidClient(config, new ObjectMapper()), null, mock(PlaidItemRepository.class),
                null, null, "", null, accounts, holdings);
        item = new PlaidItem();
        item.setId(UUID.randomUUID());
        item.setUserId("u1");
        item.setInstitutionName("Test Brokerage");
    }

    @AfterEach
    void stop() { fakePlaid.stop(0); }

    @Test
    @DisplayName("stores each account's balance and imports brokerage holdings")
    void importsBalancesAndHoldings() {
        service.refreshBalancesAndHoldings(item, new PlaidConfig("client", "secret", "sandbox",
                "http://127.0.0.1:" + fakePlaid.getAddress().getPort(), "", "").modeNamed(""), "token");

        assertThat(savedAccounts).extracting(PlaidAccount::getName).containsExactly("Plaid Checking", "Plaid Credit Card", "Plaid IRA");
        assertThat(savedAccounts.get(1).isLiability()).isTrue();
        assertThat(savedAccounts.get(0).getCurrentBalance()).isEqualByComparingTo("110.5");

        Holding vti = savedHoldings.get("plaid:ira:s1");
        assertThat(vti.getSymbol()).isEqualTo("VTI");
        assertThat(vti.getAssetType()).isEqualTo(Holding.AssetType.ETF);
        assertThat(vti.getQuantity()).isEqualByComparingTo("10");
        assertThat(vti.getLastPrice()).isEqualByComparingTo("25.5");
        assertThat(vti.getCostBasis()).isEqualByComparingTo("200.00");
        assertThat(vti.getSource()).isEqualTo(Holding.Source.PLAID);
        assertThat(vti.getAccountName()).isEqualTo("Plaid IRA ••5555");
        assertThat(savedHoldings.get("plaid:ira:s2").getAssetType()).isEqualTo(Holding.AssetType.CRYPTO);
        assertThat(savedHoldings.get("plaid:ira:s2").getCostBasis()).isNull();
        assertThat(deleted).extracting(Holding::getExternalId).containsExactly("plaid:ira:old"); // sold since last sync
    }

    @Test
    @DisplayName("Plaid security types map to asset types")
    void assetTypes() {
        assertThat(PlaidService.assetType("equity")).isEqualTo(Holding.AssetType.STOCK);
        assertThat(PlaidService.assetType("mutual fund")).isEqualTo(Holding.AssetType.FUND);
        assertThat(PlaidService.assetType("derivative")).isEqualTo(Holding.AssetType.OTHER);
    }
}
