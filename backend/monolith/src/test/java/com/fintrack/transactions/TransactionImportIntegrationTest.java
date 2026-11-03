package com.fintrack.transactions;

import com.fasterxml.jackson.databind.JsonNode;
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
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Background CSV import")
class TransactionImportIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private ObjectMapper json;
    @Autowired private TransactionRepository transactions;

    // Tokens are signed for users that aren't in the database; revocation is covered elsewhere.
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    private com.fintrack.auth.security.TokenRevocationService tokenRevocationService;

    private String userId;
    private String bearer;

    private String bearerFor(String id) {
        return "Bearer " + jwtUtil.generateToken(User.builder().id(UUID.fromString(id)).email(id + "@t.dev").build());
    }

    @BeforeEach
    void login() {
        org.mockito.Mockito.when(tokenRevocationService.isCurrent(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyInt())).thenReturn(true);
        userId = UUID.randomUUID().toString();
        bearer = bearerFor(userId);
    }

    private JsonNode poll(String jobId, String auth) throws Exception {
        JsonNode job = null;
        for (int i = 0; i < 100; i++) {
            job = json.readTree(mockMvc.perform(get("/api/transactions/import/" + jobId).header("Authorization", auth))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
            String s = job.get("status").asText();
            if (s.equals("DONE") || s.equals("FAILED")) return job;
            Thread.sleep(50);
        }
        return job;
    }

    @Test
    @DisplayName("accepts all rows at once, saves them in the background and reports progress")
    void importsInBackground() throws Exception {
        String rows = "{\"transactions\":["
                + "{\"description\":\"Coffee\",\"amount\":4.5,\"merchant\":\"Cafe\",\"category\":\"Food & Dining\",\"type\":\"expense\",\"date\":\"2026-10-01\"},"
                + "{\"description\":\"Salary\",\"amount\":2500,\"merchant\":\"Employer\",\"category\":\"Salary\",\"type\":\"income\",\"date\":\"2026-10-02\",\"paymentMethod\":\"Direct Deposit\"},"
                + "{\"description\":\"Bad row\",\"merchant\":\"No amount\",\"type\":\"expense\"}"
                + "]}";
        JsonNode started = json.readTree(mockMvc.perform(post("/api/transactions/import").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content(rows))
                .andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString());
        assertThat(started.get("total").asInt()).isEqualTo(3);

        JsonNode done = poll(started.get("jobId").asText(), bearer);
        assertThat(done.get("status").asText()).isEqualTo("DONE");
        assertThat(done.get("processed").asInt()).isEqualTo(3);
        assertThat(done.get("imported").asInt()).isEqualTo(2);
        assertThat(done.get("failed").asInt()).isEqualTo(1); // no amount: rejected, the rest still saved

        assertThat(transactions.findByUserId(userId)).hasSize(2);
    }

    @Test
    @DisplayName("another user can't see the job")
    void otherUsersJob_isNotFound() throws Exception {
        String jobId = json.readTree(mockMvc.perform(post("/api/transactions/import").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"transactions\":[{\"description\":\"Tea\",\"amount\":3,\"category\":\"Food & Dining\",\"type\":\"expense\"}]}"))
                .andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString()).get("jobId").asText();

        mockMvc.perform(get("/api/transactions/import/" + jobId).header("Authorization", bearerFor(UUID.randomUUID().toString())))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("rejects an empty import")
    void empty_isBadRequest() throws Exception {
        mockMvc.perform(post("/api/transactions/import").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"transactions\":[]}"))
                .andExpect(status().isBadRequest());
    }
}
