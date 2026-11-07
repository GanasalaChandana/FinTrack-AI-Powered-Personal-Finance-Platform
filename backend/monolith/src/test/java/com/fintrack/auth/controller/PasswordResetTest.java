package com.fintrack.auth.controller;

import com.fintrack.auth.repository.PasswordResetTokenRepository;
import com.fintrack.common.EmailService;
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

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Forgot password")
class PasswordResetTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private PasswordResetTokenRepository tokens;
    @MockitoBean private EmailService email;
    private static final AtomicInteger ip = new AtomicInteger(1);

    private String ipHeader() { return "192.0.2." + ip.getAndIncrement(); }

    private String signup() throws Exception {
        String e = "reset-" + UUID.randomUUID() + "@test.dev";
        mockMvc.perform(post("/api/auth/register").header("X-Forwarded-For", ipHeader())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + e + "\",\"password\":\"Original123!\"}"))
                .andExpect(status().isOk());
        return e;
    }

    private String requestLink(String address) throws Exception {
        when(email.send(anyString(), anyString(), anyString())).thenReturn(true);
        mockMvc.perform(post("/api/auth/forgot-password").header("X-Forwarded-For", ipHeader())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + address + "\"}"))
                .andExpect(status().isAccepted());
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(email, atLeastOnce()).send(eq(address), anyString(), body.capture());
        Matcher m = Pattern.compile("reset-password\\?token=([A-Za-z0-9_-]+)").matcher(body.getValue());
        assertThat(m.find()).isTrue();
        return m.group(1);
    }

    private org.springframework.test.web.servlet.ResultActions reset(String token, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/reset-password").header("X-Forwarded-For", ipHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\",\"password\":\"" + password + "\"}"));
    }

    private org.springframework.test.web.servlet.ResultActions login(String address, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/login").header("X-Forwarded-For", ipHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + address + "\",\"password\":\"" + password + "\"}"));
    }

    @Test
    @DisplayName("the emailed link sets a new password once; the old password stops working")
    void resetWorksOnce() throws Exception {
        String address = signup();
        String token = requestLink(address);

        reset(token, "BrandNew456!").andExpect(status().isOk());
        login(address, "BrandNew456!").andExpect(status().isOk());
        login(address, "Original123!").andExpect(status().isUnauthorized());

        reset(token, "Another789!").andExpect(status().isBadRequest()); // single use
    }

    @Test
    @DisplayName("same reply for unknown addresses, and no email is sent")
    void noEnumeration() throws Exception {
        mockMvc.perform(post("/api/auth/forgot-password").header("X-Forwarded-For", ipHeader())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"nobody-" + UUID.randomUUID() + "@test.dev\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("If an account exists")));
        verify(email, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("a newer link replaces the older one; expired and made-up links fail")
    void invalidLinks() throws Exception {
        String address = signup();
        String first = requestLink(address);
        String second = requestLink(address);
        reset(first, "BrandNew456!").andExpect(status().isBadRequest());

        tokens.findAll().forEach(t -> { t.setExpiresAt(LocalDateTime.now().minusMinutes(1)); tokens.save(t); });
        reset(second, "BrandNew456!").andExpect(status().isBadRequest());
        reset("made-up-token", "BrandNew456!").andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("the new password must be at least 8 characters")
    void shortPassword() throws Exception {
        String token = requestLink(signup());
        reset(token, "short").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Invalid password"));
    }
}
