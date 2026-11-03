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
        var body = mockMvc.perform(post("/api/auth/register")
                        .header("X-Forwarded-For", "203.0.113." + ip.getAndIncrement())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"Secret123!\"}"))
                .andExpect(status().isOk()).andReturn();
        return session(body);
    }

    /** Response body plus the session tokens, which now arrive only as HttpOnly cookies. */
    private JsonNode session(org.springframework.test.web.servlet.MvcResult r) throws Exception {
        var n = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(r.getResponse().getContentAsString());
        var at = r.getResponse().getCookie("ft_at");
        var rt = r.getResponse().getCookie("ft_rt");
        if (at != null) n.put("token", at.getValue());
        if (rt != null) n.put("refreshToken", rt.getValue());
        return n;
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
        String bearer = "Bearer " + session(mockMvc.perform(post("/api/auth/demo")).andExpect(status().isOk())
                .andReturn()).get("token").asText();

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

    // ── revocation: a token stops working the moment the session should end ──

    @Test
    @DisplayName("logout revokes the token immediately")
    void logout_revokesToken() throws Exception {
        String bearer = "Bearer " + signup("logout-" + UUID.randomUUID() + "@test.dev").get("token").asText();
        mockMvc.perform(get("/api/transactions").header("Authorization", bearer)).andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/logout").header("Authorization", bearer)).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/transactions").header("Authorization", bearer))
                .andExpect(status().is(org.hamcrest.Matchers.anyOf(org.hamcrest.Matchers.is(401), org.hamcrest.Matchers.is(403))));
    }

    @Test
    @DisplayName("changing the password revokes old tokens but keeps this session with a new one")
    void changePassword_revokesOldTokens() throws Exception {
        String email = "pw-" + UUID.randomUUID() + "@test.dev";
        String oldBearer = "Bearer " + signup(email).get("token").asText();

        var body = mockMvc.perform(post("/api/users/change-password").header("Authorization", oldBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"Secret123!\",\"newPassword\":\"Another456!\"}"))
                .andExpect(status().isOk()).andReturn();
        String newBearer = "Bearer " + session(body).get("token").asText();

        mockMvc.perform(get("/api/transactions").header("Authorization", oldBearer))
                .andExpect(status().is(org.hamcrest.Matchers.anyOf(org.hamcrest.Matchers.is(401), org.hamcrest.Matchers.is(403))));
        mockMvc.perform(get("/api/transactions").header("Authorization", newBearer)).andExpect(status().isOk());
    }

    @Test
    @DisplayName("a deleted account's token is refused")
    void deletedAccount_tokenRefused() throws Exception {
        String bearer = "Bearer " + signup("gone-" + UUID.randomUUID() + "@test.dev").get("token").asText();
        mockMvc.perform(delete("/api/users/me").header("Authorization", bearer)).andExpect(status().isOk());

        mockMvc.perform(get("/api/transactions").header("Authorization", bearer))
                .andExpect(status().is(org.hamcrest.Matchers.anyOf(org.hamcrest.Matchers.is(401), org.hamcrest.Matchers.is(403))));
    }

    @Test
    @DisplayName("signing out of the shared demo account doesn't sign out other demo visitors")
    void demoLogout_keepsOtherVisitors() throws Exception {
        String a = "Bearer " + session(mockMvc.perform(post("/api/auth/demo")).andExpect(status().isOk())
                .andReturn()).get("token").asText();
        String b = "Bearer " + session(mockMvc.perform(post("/api/auth/demo")).andExpect(status().isOk())
                .andReturn()).get("token").asText();

        mockMvc.perform(post("/api/auth/logout").header("Authorization", a)).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/transactions").header("Authorization", b)).andExpect(status().isOk());
    }

    private org.springframework.test.web.servlet.ResultActions refresh(String refreshToken) throws Exception {
        return mockMvc.perform(post("/api/auth/refresh")
                .header("X-Forwarded-For", "198.51.100." + ip.getAndIncrement())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"" + refreshToken + "\"}"));
    }

    @Test
    @DisplayName("a refresh token renews the session once; after sign-out it no longer works")
    void refreshToken_renewsOnce_andDiesOnLogout() throws Exception {
        JsonNode auth = signup("refresh-" + UUID.randomUUID() + "@test.dev");
        String firstRefresh = auth.get("refreshToken").asText();

        JsonNode renewed = session(refresh(firstRefresh).andExpect(status().isOk()).andReturn());
        String bearer = "Bearer " + renewed.get("token").asText();
        mockMvc.perform(get("/api/transactions").header("Authorization", bearer)).andExpect(status().isOk());

        // Single-use: replaying the old one fails
        refresh(firstRefresh).andExpect(status().isUnauthorized());

        // After a fresh pair and sign-out, the newest refresh token is dead too
        JsonNode again = signup("refresh2-" + UUID.randomUUID() + "@test.dev");
        mockMvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + again.get("token").asText()))
                .andExpect(status().isNoContent());
        refresh(again.get("refreshToken").asText()).andExpect(status().isUnauthorized());
    }

    // ── cookie sessions (the web app) ────────────────────────────────────────

    @Test
    @DisplayName("tokens are only in HttpOnly cookies, never in the response body")
    void tokens_onlyInHttpOnlyCookies() throws Exception {
        var r = mockMvc.perform(post("/api/auth/register")
                        .header("X-Forwarded-For", "203.0.113." + ip.getAndIncrement())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"cookie-" + UUID.randomUUID() + "@test.dev\",\"password\":\"Secret123!\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(jsonPath("$.user.email").exists())
                .andReturn();
        var at = r.getResponse().getCookie("ft_at");
        var rt = r.getResponse().getCookie("ft_rt");
        assertThat(at.isHttpOnly()).isTrue();
        assertThat(at.getSecure()).isTrue();
        assertThat(rt.isHttpOnly()).isTrue();
        assertThat(rt.getPath()).isEqualTo("/api/auth");
    }

    @Test
    @DisplayName("the session cookie authenticates reads; writes also need the X-Requested-With header")
    void cookieSession_andCsrfHeader() throws Exception {
        var at = new jakarta.servlet.http.Cookie("ft_at",
                signup("csrf-" + UUID.randomUUID() + "@test.dev").get("token").asText());
        String tx = "{\"description\":\"Coffee\",\"amount\":4.5,\"merchant\":\"Cafe\",\"category\":\"Food\",\"type\":\"EXPENSE\",\"date\":\"2026-10-01\"}";

        mockMvc.perform(get("/api/transactions").cookie(at)).andExpect(status().isOk());
        // A cross-site form post would carry the cookie but can't add the header
        mockMvc.perform(post("/api/transactions").cookie(at).contentType(MediaType.APPLICATION_JSON).content(tx))
                .andExpect(status().is(org.hamcrest.Matchers.anyOf(org.hamcrest.Matchers.is(401), org.hamcrest.Matchers.is(403))));
        mockMvc.perform(post("/api/transactions").cookie(at).header("X-Requested-With", "fintrack")
                        .contentType(MediaType.APPLICATION_JSON).content(tx))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("refresh works from the cookie, and logout clears the cookies")
    void cookieRefresh_andLogoutClears() throws Exception {
        JsonNode auth = signup("cr-" + UUID.randomUUID() + "@test.dev");
        var rt = new jakarta.servlet.http.Cookie("ft_rt", auth.get("refreshToken").asText());

        var renewed = mockMvc.perform(post("/api/auth/refresh").cookie(rt).header("X-Requested-With", "fintrack")
                        .header("X-Forwarded-For", "198.51.100." + ip.getAndIncrement()))
                .andExpect(status().isOk()).andReturn();
        var at = renewed.getResponse().getCookie("ft_at");
        assertThat(at.getValue()).isNotBlank();

        var out = mockMvc.perform(post("/api/auth/logout").cookie(at).header("X-Requested-With", "fintrack"))
                .andExpect(status().isNoContent()).andReturn();
        assertThat(out.getResponse().getCookie("ft_at").getMaxAge()).isZero();
        assertThat(out.getResponse().getCookie("ft_rt").getMaxAge()).isZero();
        mockMvc.perform(get("/api/transactions").cookie(at))
                .andExpect(status().is(org.hamcrest.Matchers.anyOf(org.hamcrest.Matchers.is(401), org.hamcrest.Matchers.is(403))));
    }
}
