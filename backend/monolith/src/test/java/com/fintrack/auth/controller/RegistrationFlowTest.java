package com.fintrack.auth.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.concurrent.atomic.AtomicInteger;

import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Sign-up and login against the real app and an in-memory database. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@DisplayName("Registration flow")
class RegistrationFlowTest {

    @Autowired private MockMvc mockMvc;
    private static final AtomicInteger ip = new AtomicInteger(1);

    private ResultActions call(String path, String json) throws Exception {
        return mockMvc.perform(post(path)
                .header("X-Forwarded-For", "198.51.100." + ip.getAndIncrement()) // stay under the per-IP limit
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private static String signup(String email, String password, String username) {
        return "{\"email\":\"" + email + "\",\"password\":\"" + password + "\",\"username\":\"" + username
                + "\",\"firstName\":\"Test\",\"lastName\":\"User\"}";
    }

    @Test
    @DisplayName("two people with the same email name (john@…) can both sign up")
    void sameEmailPrefix_bothSucceed() throws Exception {
        call("/api/auth/register", signup("john@gmail.test", "Secret123!", "john"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").exists());
        call("/api/auth/register", signup("john@yahoo.test", "Secret123!", "john"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.username").value(not("john")));
    }

    @Test
    @DisplayName("short username from the email (ab@…) is fine")
    void shortUsername_ok() throws Exception {
        call("/api/auth/register", signup("ab@short.test", "Secret123!", "ab")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("password under 8 characters → 400 with a clear message")
    void shortPassword_400() throws Exception {
        call("/api/auth/register", signup("shortpw@test.test", "abc123", "shortpw"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Password must be at least 8 characters"));
    }

    @Test
    @DisplayName("invalid email → 400")
    void badEmail_400() throws Exception {
        call("/api/auth/register", signup("not-an-email", "Secret123!", "x")).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("email is case-insensitive for sign-up and login")
    void emailCaseInsensitive() throws Exception {
        call("/api/auth/register", signup("Mixed.Case@Example.test", "Secret123!", "mixed")).andExpect(status().isOk());
        call("/api/auth/register", signup("mixed.case@example.test", "Secret123!", "mixed2")).andExpect(status().isConflict());
        call("/api/auth/login", "{\"email\":\"MIXED.case@example.TEST\",\"password\":\"Secret123!\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").exists());
    }
}
