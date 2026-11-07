package com.fintrack.plaid;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fintrack.auth.entity.User;
import com.fintrack.auth.security.JwtUtil;
import com.fintrack.transactions.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = { "plaid.client-id=test-client", "plaid.secret=test-secret" })
@DisplayName("Bank connections (Plaid)")
class PlaidIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private ObjectMapper json;
    @Autowired private TransactionRepository transactions;
    @Autowired private PlaidItemRepository items;
    @Autowired private TokenCipher cipher;
    @MockitoBean private PlaidClient plaid; // a fake Plaid
    @MockitoBean private com.fintrack.auth.security.TokenRevocationService tokenRevocationService;

    private String user, bearer;

    @BeforeEach
    void setUp() {
        when(tokenRevocationService.isCurrent(any(), anyInt())).thenReturn(true);
        user = UUID.randomUUID().toString();
        bearer = "Bearer " + jwtUtil.generateToken(User.builder().id(UUID.fromString(user)).email(user + "@t.dev").build());
    }

    private com.fasterxml.jackson.databind.JsonNode page(String body) throws Exception {
        return json.readTree(body);
    }

    @Test
    @DisplayName("connect imports transactions; a later sync applies modifications and removals without duplicates")
    void connectAndSync() throws Exception {
        String item = "item-" + UUID.randomUUID();
        when(plaid.exchangePublicToken("public-123")).thenReturn(new String[] { "access-secret", item });
        when(plaid.transactionsSync(eq("access-secret"), isNull())).thenReturn(page("""
            {"added":[
               {"transaction_id":"t1","amount":12.5,"date":"2026-10-01","name":"UBER 123","merchant_name":"Uber","pending":false},
               {"transaction_id":"t2","amount":-2500,"date":"2026-10-02","name":"ACME PAYROLL","merchant_name":null,"pending":false}],
             "modified":[],"removed":[],"next_cursor":"c1","has_more":false}"""));

        mockMvc.perform(post("/api/plaid/connect").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"publicToken\":\"public-123\",\"institutionName\":\"First Platypus Bank\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.added").value(2));

        var uber = transactions.findByUserIdAndExternalId(user, "plaid:t1").orElseThrow();
        assertThat(uber.getType()).isEqualTo("EXPENSE");
        assertThat(uber.getAmount()).isEqualByComparingTo("12.5");
        assertThat(uber.getMerchant()).isEqualTo("Uber");
        assertThat(uber.getCategory()).isEqualTo("Transportation"); // categorised from the user's rules/keywords
        var pay = transactions.findByUserIdAndExternalId(user, "plaid:t2").orElseThrow();
        assertThat(pay.getType()).isEqualTo("INCOME");
        assertThat(pay.getMerchant()).isEqualTo("ACME PAYROLL");

        // The access token is stored encrypted
        PlaidItem saved = items.findByUserId(user).get(0);
        assertThat(saved.getAccessTokenEnc()).doesNotContain("access-secret");
        assertThat(cipher.decrypt(saved.getAccessTokenEnc())).isEqualTo("access-secret");

        // The user re-categorises t1; Plaid then modifies its amount and removes t2
        uber.setCategory("Work travel");
        transactions.save(uber);
        when(plaid.transactionsSync("access-secret", "c1")).thenReturn(page("""
            {"added":[{"transaction_id":"t1","amount":12.5,"date":"2026-10-01","name":"UBER 123","merchant_name":"Uber"}],
             "modified":[{"transaction_id":"t1","amount":14.0,"date":"2026-10-01","name":"UBER 123","merchant_name":"Uber"}],
             "removed":[{"transaction_id":"t2"}],"next_cursor":"c2","has_more":false}"""));

        mockMvc.perform(post("/api/plaid/items/" + saved.getId() + "/sync").header("Authorization", bearer).header("X-Requested-With", "x"))
                .andExpect(status().isOk());
        var after = transactions.findByUserIdAndExternalId(user, "plaid:t1").orElseThrow();
        assertThat(after.getAmount()).isEqualByComparingTo("14.0");
        assertThat(after.getCategory()).isEqualTo("Work travel"); // the user's choice is kept
        assertThat(transactions.findByUserIdAndExternalId(user, "plaid:t2")).isEmpty();
        assertThat(transactions.findByUserId(user).stream().filter(t -> "plaid:t1".equals(t.getExternalId())).count()).isEqualTo(1);
        assertThat(items.findById(saved.getId()).orElseThrow().getSyncCursor()).isEqualTo("c2");
    }

    @Test
    @DisplayName("a bank that needs a new sign-in is flagged; others can't see or touch the connection")
    void loginRequiredAndOwnership() throws Exception {
        when(plaid.exchangePublicToken("p2")).thenReturn(new String[] { "a2", "item-" + UUID.randomUUID() });
        when(plaid.transactionsSync(eq("a2"), any()))
                .thenThrow(new PlaidClient.PlaidException("ITEM_LOGIN_REQUIRED", "the login details of this item have changed"));
        mockMvc.perform(post("/api/plaid/connect").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content("{\"publicToken\":\"p2\"}")).andExpect(status().isCreated());
        mockMvc.perform(get("/api/plaid/items").header("Authorization", bearer))
                .andExpect(jsonPath("$[0].status").value("LOGIN_REQUIRED"))
                .andExpect(jsonPath("$[0].accessTokenEnc").doesNotExist());

        UUID id = items.findByUserId(user).get(0).getId();
        String other = UUID.randomUUID().toString();
        String otherBearer = "Bearer " + jwtUtil.generateToken(User.builder().id(UUID.fromString(other)).email(other + "@t.dev").build());
        mockMvc.perform(get("/api/plaid/items").header("Authorization", otherBearer)).andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(delete("/api/plaid/items/" + id).header("Authorization", otherBearer).header("X-Requested-With", "x"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(delete("/api/plaid/items/" + id).header("Authorization", bearer).header("X-Requested-With", "x"))
                .andExpect(status().isNoContent());
        verify(plaid).removeItem("a2");
    }

    @Test
    @DisplayName("status reports enabled when keys are set")
    void statusEndpoint() throws Exception {
        mockMvc.perform(get("/api/plaid/status").header("Authorization", bearer)).andExpect(jsonPath("$.enabled").value(true));
    }
}
