package com.fintrack.auth.controller;

import com.fintrack.auth.security.JwtUtil;
import com.fintrack.auth.security.LoginRateLimiter;
import com.fintrack.auth.service.AuthService;
import com.fintrack.auth.service.DemoService;
import com.fintrack.auth.service.GoogleAuthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Login rate limiting must hold even when the client fakes X-Forwarded-For.
 */
@WebMvcTest(
    controllers = AuthController.class,
    excludeAutoConfiguration = SecurityAutoConfiguration.class
)
@Import(LoginRateLimiter.class)
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD) // fresh limiter state per test
@DisplayName("AuthController rate limiting")
class AuthControllerRateLimitTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean private AuthService authService;
    @MockBean private GoogleAuthService googleAuthService;
    @MockBean private DemoService demoService;

    // Required so @WebMvcTest can wire the JwtAuthenticationFilter in SecurityConfig
    @MockBean
    @SuppressWarnings("unused")
    private JwtUtil jwtUtil;

    private static String body(String email) {
        return "{\"email\":\"" + email + "\",\"password\":\"wrong-password\"}";
    }

    @Test
    @DisplayName("faking a new X-Forwarded-For IP each time doesn't bypass the per-account limit")
    void spoofedIps_sameAccount_blocked() throws Exception {
        when(authService.login(any())).thenThrow(new RuntimeException("Invalid credentials"));

        for (int i = 1; i <= 5; i++) {
            mockMvc.perform(post("/api/auth/login")
                            .header("X-Forwarded-For", "10.0.0." + i)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body("victim@example.com")))
                    .andExpect(status().isUnauthorized());
        }

        // 6th attempt from yet another fake IP, different email casing — still the same account
        mockMvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", "10.0.0.99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Victim@Example.com")))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    @DisplayName("CF-Connecting-IP is used for the IP limit, ignoring X-Forwarded-For")
    void cloudflareIp_used_forIpLimit() throws Exception {
        when(authService.login(any())).thenThrow(new RuntimeException("Invalid credentials"));

        for (int i = 1; i <= 5; i++) {
            mockMvc.perform(post("/api/auth/login")
                            .header("CF-Connecting-IP", "203.0.113.5")
                            .header("X-Forwarded-For", "10.0.0." + i)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body("user" + i + "@example.com")))
                    .andExpect(status().isUnauthorized());
        }

        mockMvc.perform(post("/api/auth/login")
                        .header("CF-Connecting-IP", "203.0.113.5")
                        .header("X-Forwarded-For", "10.0.0.99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("someone-else@example.com")))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    @DisplayName("a different account from a different IP is not affected")
    void otherAccount_notBlocked() throws Exception {
        when(authService.login(any())).thenThrow(new RuntimeException("Invalid credentials"));

        for (int i = 1; i <= 5; i++) {
            mockMvc.perform(post("/api/auth/login")
                    .header("X-Forwarded-For", "10.0.0." + i)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body("victim@example.com")));
        }

        mockMvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", "198.51.100.7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("innocent@example.com")))
                .andExpect(status().isUnauthorized()); // normal failure, not rate limited
    }
}
