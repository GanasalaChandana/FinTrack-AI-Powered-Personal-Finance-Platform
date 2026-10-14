package com.fintrack.alerts.controller;

import com.fintrack.alerts.entity.Alert;
import com.fintrack.alerts.service.AlertService;
import com.fintrack.auth.security.JwtUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Ownership checks for AlertController: a user must never read, change or
 * create alerts belonging to someone else.
 */
@WebMvcTest(
    controllers = AlertController.class,
    excludeAutoConfiguration = SecurityAutoConfiguration.class
)
@ActiveProfiles("test")
@DisplayName("AlertController ownership")
class AlertControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AlertService alertService;

    // Required so @WebMvcTest can wire the JwtAuthenticationFilter in SecurityConfig
    @MockBean
    @SuppressWarnings("unused")
    private JwtUtil jwtUtil;

    private static final String OWNER    = "user-owner";
    private static final String STRANGER = "user-stranger";

    private Alert alertOwnedBy(String userId) {
        Alert a = new Alert();
        a.setId(7L);
        a.setUserId(userId);
        a.setMessage("Spent $887.40 at Merchant 3");
        return a;
    }

    @Test
    @DisplayName("GET /{id} returns the alert to its owner")
    void getById_owner_ok() throws Exception {
        when(alertService.getAlertById(7L)).thenReturn(alertOwnedBy(OWNER));

        mockMvc.perform(get("/api/alerts/7").header("X-User-Id", OWNER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(7));
    }

    @Test
    @DisplayName("GET /{id} hides another user's alert (404)")
    void getById_stranger_notFound() throws Exception {
        when(alertService.getAlertById(7L)).thenReturn(alertOwnedBy(OWNER));

        mockMvc.perform(get("/api/alerts/7").header("X-User-Id", STRANGER))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /{id} without a user is 401")
    void getById_noUser_unauthorized() throws Exception {
        mockMvc.perform(get("/api/alerts/7"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(alertService);
    }

    @Test
    @DisplayName("GET /user/{userId} only allows the caller's own id")
    void getByUser_otherUser_forbidden() throws Exception {
        mockMvc.perform(get("/api/alerts/user/" + OWNER).header("X-User-Id", STRANGER))
                .andExpect(status().isForbidden());
        verify(alertService, never()).getAlertsByUserId(anyString());
    }

    @Test
    @DisplayName("GET /user/{userId} works for the caller's own id")
    void getByUser_self_ok() throws Exception {
        when(alertService.getAlertsByUserId(OWNER)).thenReturn(List.of(alertOwnedBy(OWNER)));

        mockMvc.perform(get("/api/alerts/user/" + OWNER).header("X-User-Id", OWNER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    @DisplayName("GET / without a user never returns every user's alerts")
    void getAll_noUser_unauthorized() throws Exception {
        mockMvc.perform(get("/api/alerts"))
                .andExpect(status().isUnauthorized());
        verify(alertService, never()).getAllAlerts();
    }

    @Test
    @DisplayName("PATCH /{id}/status is forbidden on another user's alert")
    void patchStatus_stranger_forbidden() throws Exception {
        when(alertService.getAlertById(7L)).thenReturn(alertOwnedBy(OWNER));

        mockMvc.perform(patch("/api/alerts/7/status").param("status", "READ").header("X-User-Id", STRANGER))
                .andExpect(status().isForbidden());
        verify(alertService, never()).updateAlertStatus(anyLong(), anyString());
    }

    @Test
    @DisplayName("PATCH /{id}/status works for the owner")
    void patchStatus_owner_ok() throws Exception {
        Alert alert = alertOwnedBy(OWNER);
        when(alertService.getAlertById(7L)).thenReturn(alert);
        when(alertService.updateAlertStatus(7L, "READ")).thenReturn(alert);

        mockMvc.perform(patch("/api/alerts/7/status").param("status", "READ").header("X-User-Id", OWNER))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("POST ignores a userId in the body and uses the caller's id")
    void create_bodyUserIdIgnored() throws Exception {
        when(alertService.createAlert(any(Alert.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(post("/api/alerts")
                        .header("X-User-Id", STRANGER)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + OWNER + "\",\"message\":\"hello\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value(STRANGER));
    }

    @Test
    @DisplayName("POST /acknowledge-all without a user never touches every user's alerts")
    void acknowledgeAll_noUser_unauthorized() throws Exception {
        mockMvc.perform(post("/api/alerts/acknowledge-all"))
                .andExpect(status().isUnauthorized());
        verify(alertService, never()).acknowledgeAllAlerts();
    }
}
