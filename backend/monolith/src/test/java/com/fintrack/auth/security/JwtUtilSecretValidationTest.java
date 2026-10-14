package com.fintrack.auth.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("JwtUtil secret validation")
class JwtUtilSecretValidationTest {

    private static JwtUtil withSecret(String secret) {
        JwtUtil util = new JwtUtil();
        ReflectionTestUtils.setField(util, "secret", secret);
        return util;
    }

    @Test
    @DisplayName("refuses to start without a secret")
    void missingSecret_rejected() {
        assertThatThrownBy(() -> withSecret("").validateSecret())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not set");
        assertThatThrownBy(() -> withSecret(null).validateSecret())
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("refuses a secret shorter than 32 bytes")
    void shortSecret_rejected() {
        assertThatThrownBy(() -> withSecret("too-short-secret").validateSecret())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("too short");
    }

    @Test
    @DisplayName("refuses publicly known secrets (old defaults / README placeholder)")
    void knownPublicSecrets_rejected() {
        assertThatThrownBy(() -> withSecret("default-secret-change-in-production").validateSecret())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("publicly known");
        assertThatThrownBy(() -> withSecret("your-256-bit-secret-min-32-chars").validateSecret())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("publicly known");
    }

    @Test
    @DisplayName("accepts a long random secret")
    void randomSecret_accepted() {
        assertThatCode(() -> withSecret("q8Zr3v6Yb1Lm0Xc4Tn7Wp2Hs5Kd9Fj3Gu6Ae1Ri8Oy4Vt0Bz").validateSecret())
                .doesNotThrowAnyException();
    }
}
