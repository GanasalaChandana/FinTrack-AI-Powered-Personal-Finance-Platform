package com.fintrack.plaid;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Plaid settings: PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV (sandbox | development |
 * production). Bank connections are off until the client id and secret are set.
 */
@Component
public class PlaidConfig {

    private final String clientId;
    private final String secret;
    private final String env;
    private final String baseUrl;

    public PlaidConfig(@Value("${plaid.client-id:}") String clientId,
                       @Value("${plaid.secret:}") String secret,
                       @Value("${plaid.env:sandbox}") String env,
                       @Value("${plaid.base-url:}") String baseUrlOverride) {
        this.clientId = clientId;
        this.secret = secret;
        this.env = env == null || env.isBlank() ? "sandbox" : env.trim().toLowerCase();
        this.baseUrl = baseUrlOverride != null && !baseUrlOverride.isBlank()
                ? baseUrlOverride.replaceAll("/+$", "")
                : "https://" + this.env + ".plaid.com";
    }

    public boolean isEnabled() {
        return clientId != null && !clientId.isBlank() && secret != null && !secret.isBlank();
    }

    public String clientId() { return clientId; }
    public String secret() { return secret; }
    public String env() { return env; }
    public String baseUrl() { return baseUrl; }
}
