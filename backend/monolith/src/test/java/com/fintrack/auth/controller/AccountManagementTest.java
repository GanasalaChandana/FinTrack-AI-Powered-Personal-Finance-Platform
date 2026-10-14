package com.fintrack.auth.controller;

import com.fintrack.auth.repository.RefreshTokenRepository;
import com.fintrack.auth.repository.UserRepository;
import com.fintrack.budgets.repository.BudgetRepository;
import com.fintrack.transactions.repository.TransactionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Account management")
class AccountManagementTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper json;
    @Autowired private UserRepository users;
    @Autowired private RefreshTokenRepository refreshTokens;
    @Autowired private TransactionRepository transactions;
    @Autowired private BudgetRepository budgets;
    private static final AtomicInteger ip = new AtomicInteger(1);

    private JsonNode signup(String email) throws Exception {
        String body = mockMvc.perform(post("/api/auth/register")
                        .header("X-Forwarded-For", "203.0.113." + ip.getAndIncrement())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"Secret123!\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body);
    }

    @Test
    @DisplayName("deleting an account removes the user, their sessions and all their data")
    void deleteAccount_removesEverything() throws Exception {
        JsonNode auth = signup("delete-me-" + UUID.randomUUID() + "@test.dev");
        String bearer = "Bearer " + auth.get("token").asText();
        String userId = auth.get("user").get("id").asText();

        mockMvc.perform(post("/api/transactions").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"description\":\"Coffee\",\"amount\":4.5,\"merchant\":\"Cafe\",\"category\":\"Food & Dining\",\"type\":\"EXPENSE\",\"date\":\"2026-10-01\"}"))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/api/budgets").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"Food & Dining\",\"budget\":200}"))
                .andExpect(status().is2xxSuccessful());
        assertThat(transactions.findAll().stream().anyMatch(t -> userId.equals(t.getUserId()))).isTrue();

        mockMvc.perform(delete("/api/users/me").header("Authorization", bearer)).andExpect(status().isOk());

        assertThat(users.findById(UUID.fromString(userId))).isEmpty();
        assertThat(transactions.findAll().stream().noneMatch(t -> userId.equals(t.getUserId()))).isTrue();
        assertThat(budgets.findByUserId(userId)).isEmpty();
        assertThat(refreshTokens.findAll().stream().noneMatch(rt -> rt.getUser().getId().toString().equals(userId))).isTrue();
    }

    @Test
    @DisplayName("the shared demo account can't be deleted or have its password changed")
    void demoAccount_protected() throws Exception {
        String body = mockMvc.perform(post("/api/auth/demo")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String bearer = "Bearer " + json.readTree(body).get("token").asText();

        mockMvc.perform(delete("/api/users/me").header("Authorization", bearer)).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/users/change-password").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"x\",\"newPassword\":\"Whatever123\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("new password must be at least 8 characters")
    void changePassword_tooShort() throws Exception {
        JsonNode auth = signup("pw-" + UUID.randomUUID() + "@test.dev");
        mockMvc.perform(post("/api/users/change-password").header("Authorization", "Bearer " + auth.get("token").asText())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"Secret123!\",\"newPassword\":\"short\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("New password must be at least 8 characters"));
    }
}
