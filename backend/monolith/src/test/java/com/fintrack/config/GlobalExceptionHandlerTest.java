package com.fintrack.config;

import com.fintrack.auth.entity.User;
import com.fintrack.auth.security.JwtUtil;
import com.fintrack.transactions.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Sends real requests through the full app (security, filters, all advice beans)
 * so the status codes and bodies are exactly what the frontend gets.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("API error responses")
class GlobalExceptionHandlerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtUtil jwtUtil;
    @SpyBean   private TransactionRepository transactionRepository;

    private String bearer;

    @BeforeEach
    void login() {
        User user = User.builder().id(UUID.randomUUID()).email("errors@test.dev").build();
        bearer = "Bearer " + jwtUtil.generateToken(user);
    }

    @Test
    @DisplayName("missing transaction → 404 with a clear message")
    void missingTransaction_404() throws Exception {
        mockMvc.perform(get("/api/transactions/987654").header("Authorization", bearer))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Transaction not found"));
    }

    @Test
    @DisplayName("unknown URL → 404, not 500")
    void unknownUrl_404() throws Exception {
        mockMvc.perform(get("/api/does-not-exist").header("Authorization", bearer))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("wrong HTTP method → 405, not 500")
    void wrongMethod_405() throws Exception {
        mockMvc.perform(patch("/api/transactions").header("Authorization", bearer))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    @DisplayName("malformed JSON body → 400, not 500")
    void malformedBody_400() throws Exception {
        mockMvc.perform(post("/api/budgets").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{not json"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("unexpected failure → 500 with no internal details")
    void unexpectedError_genericMessage() throws Exception {
        doThrow(new RuntimeException("ERROR: relation \"transactions\" does not exist; SQL [select ...] host db.internal"))
                .when(transactionRepository).findByUserId(any(), any());

        mockMvc.perform(get("/api/transactions").header("Authorization", bearer))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"))
                .andExpect(content().string(not(containsString("db.internal"))))
                .andExpect(content().string(not(containsString("SQL"))));
    }
}
