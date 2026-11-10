package com.fintrack.auth.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Demo account guard")
class DemoGuardTest {

    @Test
    @DisplayName("account settings are refused for the shared demo account")
    void accountSettingsBlocked() {
        assertThat(DemoGuard.blocked("PUT", "/api/users/profile")).isTrue();
        assertThat(DemoGuard.blocked("DELETE", "/api/users/me")).isTrue();
        assertThat(DemoGuard.blocked("POST", "/api/users/change-password")).isTrue();
        assertThat(DemoGuard.blocked("POST", "/api/users/me/2fa/setup")).isTrue();
        assertThat(DemoGuard.blocked("POST", "/api/households/me/invites")).isTrue();
        assertThat(DemoGuard.blocked("POST", "/api/push/subscriptions")).isTrue();
    }

    @Test
    @DisplayName("reading, and editing transactions, budgets and goals still work")
    void normalUseAllowed() {
        assertThat(DemoGuard.blocked("GET", "/api/users/profile")).isFalse();
        assertThat(DemoGuard.blocked("POST", "/api/transactions")).isFalse();
        assertThat(DemoGuard.blocked("PUT", "/api/budgets/5")).isFalse();
        assertThat(DemoGuard.blocked("DELETE", "/api/push/subscriptions")).isFalse();
        assertThat(DemoGuard.isDemo("Demo@FinTrack.app")).isTrue();
        assertThat(DemoGuard.isDemo("me@example.com")).isFalse();
    }
}
