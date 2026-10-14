package com.fintrack.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Boots the whole app (also proving it starts with a valid JWT secret) and
 * checks that only the bare health status is public.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Actuator exposure")
class ActuatorExposureTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("/actuator/health is public but shows only the status")
    void health_publicStatusOnly() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(jsonPath("$.status").exists())
                .andExpect(jsonPath("$.components").doesNotExist());
    }

    @Test
    @DisplayName("other actuator endpoints are not reachable without a login")
    void otherEndpoints_notPublic() throws Exception {
        for (String path : new String[] {"/actuator/prometheus", "/actuator/info", "/actuator/env", "/actuator/beans"}) {
            mockMvc.perform(get(path))
                    .andExpect(status().is(anyOf(is(401), is(403), is(404))));
        }
    }

    @Test
    @DisplayName("the removed budget trigger endpoint is gone")
    void triggerCheck_removed() throws Exception {
        mockMvc.perform(post("/api/alerts/trigger-check"))
                .andExpect(status().is(anyOf(is(401), is(404))));
    }
}
