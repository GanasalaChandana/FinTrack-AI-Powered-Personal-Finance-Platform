package com.fintrack.auth.twofactor;

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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Two-factor sign-in")
class TwoFactorTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    private static final AtomicInteger ip = new AtomicInteger(1);
    private static final String PASSWORD = "Secret123!";

    private ResultActions call(MockHttpServletRequestBuilder req, String bearer, String body) throws Exception {
        req.header("X-Forwarded-For", "198.51.100." + ip.getAndIncrement());
        if (bearer != null) req.header("Authorization", bearer);
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(body);
        return mvc.perform(req);
    }

    private String signup(String email) throws Exception {
        var r = call(post("/api/auth/register"), null, "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}")
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + r.getResponse().getCookie("ft_at").getValue();
    }

    private ResultActions login(String email, String code) throws Exception {
        String c = code == null ? "" : ",\"twoFactorCode\":\"" + code + "\"";
        return call(post("/api/auth/login"), null, "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"" + c + "}");
    }

    @Test
    @DisplayName("Totp matches the RFC 6238 test vector")
    void rfcVector() {
        // RFC 6238 appendix B, SHA1, T = 59s -> 94287082 (last 6 digits: 287082)
        String secret = Totp.base32("12345678901234567890".getBytes());
        assertThat(Totp.code(secret, 59 / 30)).isEqualTo("287082");
        assertThat(Totp.unbase32(secret)).isEqualTo("12345678901234567890".getBytes());
    }

    @Test
    @DisplayName("setup, sign-in with a code, no code reuse, backup codes, turning it off")
    void fullFlow() throws Exception {
        String email = "tfa-" + UUID.randomUUID() + "@test.dev";
        String bearer = signup(email);

        call(get("/api/users/me/2fa"), bearer, null).andExpect(jsonPath("$.enabled").value(false));
        JsonNode setup = json.readTree(call(post("/api/users/me/2fa/setup"), bearer, null)
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        String secret = setup.get("secret").asText();
        assertThat(setup.get("otpauthUrl").asText()).startsWith("otpauth://totp/FinTrack").contains("secret=" + secret);

        // Not on until a code is confirmed
        login(email, null).andExpect(status().isOk()).andExpect(cookie().exists("ft_at"));
        call(post("/api/users/me/2fa/enable"), bearer, "{\"code\":\"000000\"}").andExpect(status().isBadRequest());
        long step = Totp.currentStep(System.currentTimeMillis());
        String firstCode = Totp.code(secret, step);
        JsonNode enabled = json.readTree(call(post("/api/users/me/2fa/enable"), bearer, "{\"code\":\"" + firstCode + "\"}")
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(enabled.get("backupCodes")).hasSize(10);
        String backup = enabled.get("backupCodes").get(0).asText();

        // Password alone: asked for a code, no session
        login(email, null).andExpect(status().isOk()).andExpect(jsonPath("$.twoFactorRequired").value(true))
                .andExpect(cookie().doesNotExist("ft_at"));
        login(email, "123456").andExpect(status().isUnauthorized()).andExpect(cookie().doesNotExist("ft_at"));
        // The code used to enable can't be used again; the next one works
        login(email, firstCode).andExpect(status().isUnauthorized());
        login(email, Totp.code(secret, step + 1)).andExpect(status().isOk()).andExpect(cookie().exists("ft_at"));

        // A backup code works once (dashes and capitals don't matter)
        login(email, backup.toUpperCase()).andExpect(status().isOk()).andExpect(cookie().exists("ft_at"));
        login(email, backup).andExpect(status().isUnauthorized());
        call(get("/api/users/me/2fa"), bearer, null).andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.backupCodesLeft").value(9));

        // Turning it off needs the password and a code
        String backup2 = enabled.get("backupCodes").get(1).asText();
        call(post("/api/users/me/2fa/disable"), bearer, "{\"password\":\"wrong\",\"code\":\"" + backup2 + "\"}")
                .andExpect(status().isBadRequest());
        call(post("/api/users/me/2fa/disable"), bearer, "{\"password\":\"" + PASSWORD + "\",\"code\":\"" + backup2 + "\"}")
                .andExpect(status().isOk());
        login(email, null).andExpect(status().isOk()).andExpect(cookie().exists("ft_at"));
    }
}
