package com.fintrack.households;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fintrack.auth.entity.User;
import com.fintrack.auth.repository.UserRepository;
import com.fintrack.auth.security.JwtUtil;
import com.fintrack.common.EmailService;
import com.fintrack.transactions.entity.Transaction;
import com.fintrack.transactions.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Households and shared budgets")
class HouseholdTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtUtil jwt;
    @Autowired private UserRepository users;
    @Autowired private TransactionRepository transactions;
    @Autowired private ObjectMapper json;
    @MockitoBean private EmailService email;
    @MockitoBean private com.fintrack.auth.security.TokenRevocationService revocation;

    record Person(String id, String email, String bearer) {}
    private Person alice, bob, eve;
    private final String month = YearMonth.now().toString();

    @BeforeEach
    void setUp() {
        when(revocation.isCurrent(any(), anyInt())).thenReturn(true);
        when(email.send(anyString(), anyString(), anyString())).thenReturn(true);
        alice = person("alice"); bob = person("bob"); eve = person("eve");
    }

    private Person person(String name) {
        User u = users.save(User.builder().email(name + "-" + UUID.randomUUID() + "@test.dev").firstName(name).passwordHash("x").build());
        return new Person(u.getId().toString(), u.getEmail(), "Bearer " + jwt.generateToken(u));
    }

    private ResultActions call(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder r, Person p, String body) throws Exception {
        r = r.header("Authorization", p.bearer());
        if (body != null) r = r.contentType(MediaType.APPLICATION_JSON).content(body);
        return mvc.perform(r);
    }

    private JsonNode read(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }

    private void spend(Person p, double amount, String category) {
        Transaction t = new Transaction();
        t.setUserId(p.id()); t.setType("EXPENSE"); t.setAmount(BigDecimal.valueOf(amount));
        t.setCategory(category); t.setDescription("x"); t.setMerchant("x"); t.setDate(LocalDate.now());
        transactions.save(t);
    }

    /** Alice creates a household and invites Bob; returns the invite token. */
    private String aliceInvitesBob() throws Exception {
        call(post("/api/households"), alice, "{\"name\":\"Home\"}").andExpect(status().isCreated());
        call(post("/api/households/me/invites"), alice, "{\"email\":\"" + bob.email() + "\"}").andExpect(status().isCreated());
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(email).send(eq(bob.email().toLowerCase()), anyString(), body.capture());
        Matcher m = Pattern.compile("household/join\\?token=([A-Za-z0-9_-]+)").matcher(body.getValue());
        assertThat(m.find()).isTrue();
        return m.group(1);
    }

    @Test
    @DisplayName("an invite works only for the invited email, once")
    void inviteAndJoin() throws Exception {
        String token = aliceInvitesBob();
        call(post("/api/households/join"), eve, "{\"token\":\"" + token + "\"}")
                .andExpect(status().isBadRequest()); // wrong account
        JsonNode h = read(call(post("/api/households/join"), bob, "{\"token\":\"" + token + "\"}").andExpect(status().isOk()));
        assertThat(h.get("members")).hasSize(2);
        assertThat(h.get("youAreOwner").asBoolean()).isFalse();
        call(post("/api/households/join"), bob, "{\"token\":\"" + token + "\"}").andExpect(status().isBadRequest()); // used
        call(get("/api/households/me"), eve, null).andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("a shared budget is visible to members and counts everyone's spending; transactions stay private")
    void sharedBudget() throws Exception {
        call(post("/api/households/join"), bob, "{\"token\":\"" + aliceInvitesBob() + "\"}").andExpect(status().isOk());
        JsonNode budget = read(call(post("/api/budgets"), alice,
                "{\"category\":\"Groceries\",\"budget\":500,\"month\":\"" + month + "\",\"shareWithHousehold\":true}")
                .andExpect(status().isCreated()));
        assertThat(budget.get("shared").asBoolean()).isTrue();
        long id = budget.get("id").asLong();

        spend(alice, 120, "Groceries");
        spend(bob, 80, "groceries");
        spend(eve, 999, "Groceries"); // not in the household

        JsonNode bobsBudgets = read(call(get("/api/budgets").param("month", month), bob, null).andExpect(status().isOk()));
        JsonNode shared = null;
        for (JsonNode b : bobsBudgets) if (b.get("id").asLong() == id) shared = b;
        assertThat(shared).isNotNull();
        assertThat(shared.get("spent").asDouble()).isEqualTo(200.0);

        // Bob can edit the amount, but not unshare or delete Alice's budget
        call(put("/api/budgets/" + id), bob, "{\"category\":\"Groceries\",\"budget\":600,\"month\":\"" + month + "\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.budget").value(600.0));
        call(put("/api/budgets/" + id), bob, "{\"category\":\"Groceries\",\"budget\":600,\"shareWithHousehold\":false}")
                .andExpect(status().isForbidden());
        call(delete("/api/budgets/" + id), bob, null).andExpect(status().isForbidden());

        // Outsiders can't see it; members still can't see each other's transactions
        call(get("/api/budgets/" + id), eve, null).andExpect(status().isNotFound());
        JsonNode bobsTx = read(call(get("/api/transactions"), bob, null));
        for (JsonNode t : bobsTx) assertThat(t.get("userId").asText()).isEqualTo(bob.id());

        // Bob leaves: Alice's budget stays shared for the remaining household but Bob no longer sees it
        call(post("/api/households/me/leave"), bob, null).andExpect(status().isNoContent());
        call(get("/api/budgets/" + id), bob, null).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("sharing needs a household; the request can't pick someone else's household")
    void sharingRules() throws Exception {
        call(post("/api/budgets"), eve, "{\"category\":\"Fun\",\"budget\":50,\"month\":\"" + month + "\",\"shareWithHousehold\":true}")
                .andExpect(status().isBadRequest());
        call(post("/api/households"), alice, "{\"name\":\"Home\"}").andExpect(status().isCreated());
        String aliceHousehold = read(call(get("/api/households/me"), alice, null)).get("id").asText();
        JsonNode b = read(call(post("/api/budgets"), eve,
                "{\"category\":\"Fun\",\"budget\":50,\"month\":\"" + month + "\",\"householdId\":\"" + aliceHousehold + "\"}")
                .andExpect(status().isCreated()));
        assertThat(b.get("shared").asBoolean()).isFalse(); // householdId in the body is ignored
    }

    @Test
    @DisplayName("deleting the household makes every shared budget personal again")
    void deleteHousehold() throws Exception {
        call(post("/api/households/join"), bob, "{\"token\":\"" + aliceInvitesBob() + "\"}").andExpect(status().isOk());
        long id = read(call(post("/api/budgets"), bob,
                "{\"category\":\"Rent\",\"budget\":900,\"month\":\"" + month + "\",\"shareWithHousehold\":true}")).get("id").asLong();
        call(delete("/api/households/me"), bob, null).andExpect(status().isBadRequest()); // only the owner
        call(delete("/api/households/me"), alice, null).andExpect(status().isNoContent());
        call(get("/api/budgets/" + id), bob, null).andExpect(jsonPath("$.shared").value(false));
        call(get("/api/budgets/" + id), alice, null).andExpect(status().isNotFound());
    }
}
