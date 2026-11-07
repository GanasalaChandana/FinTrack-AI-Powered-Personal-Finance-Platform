package com.fintrack.notifications;

import com.fintrack.auth.entity.User;
import com.fintrack.auth.security.JwtUtil;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Notification settings")
class NotificationSettingsTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtUtil jwtUtil;

    @org.springframework.test.context.bean.override.mockito.MockitoBean
    private com.fintrack.auth.security.TokenRevocationService tokenRevocationService;

    private String user, bearer;

    @BeforeEach
    void setUp() {
        org.mockito.Mockito.when(tokenRevocationService.isCurrent(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyInt())).thenReturn(true);
        user = UUID.randomUUID().toString();
        bearer = "Bearer " + jwtUtil.generateToken(User.builder().id(UUID.fromString(user)).email(user + "@t.dev").build());
    }

    @Test
    @DisplayName("defaults on first read; an update changes only the fields it sends")
    void defaultsAndPartialUpdate() throws Exception {
        mockMvc.perform(get("/api/notifications/settings/" + user).header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.budgetAlertsEnabled").value(true))
                .andExpect(jsonPath("$.weeklyDigest").value(false))
                .andExpect(jsonPath("$.largeTransactionThreshold").value(500));

        mockMvc.perform(put("/api/notifications/settings/" + user).header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weeklyDigest\":true,\"largeTransactionThreshold\":250}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/notifications/settings/" + user).header("Authorization", bearer))
                .andExpect(jsonPath("$.weeklyDigest").value(true))
                .andExpect(jsonPath("$.largeTransactionThreshold").value(250))
                .andExpect(jsonPath("$.budgetAlertsEnabled").value(true)); // untouched
    }

    @Test
    @DisplayName("one user can't read or change another's settings")
    void ownership() throws Exception {
        String other = UUID.randomUUID().toString();
        mockMvc.perform(get("/api/notifications/settings/" + other).header("Authorization", bearer))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/notifications/settings/" + other).header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"weeklyDigest\":true}"))
                .andExpect(status().isForbidden());
    }
}
