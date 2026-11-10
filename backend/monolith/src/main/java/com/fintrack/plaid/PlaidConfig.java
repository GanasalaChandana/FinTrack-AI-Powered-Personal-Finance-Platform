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
    private final String redirectUri;
    private final java.util.List<String> countryCodes;

    public PlaidConfig(@Value("${plaid.client-id:}") String clientId,
                       @Value("${plaid.secret:}") String secret,
                       @Value("${plaid.env:sandbox}") String env,
                       @Value("${plaid.base-url:}") String baseUrlOverride,
                       @Value("${plaid.redirect-uri:}") String redirectUri,
                       @Value("${plaid.country-codes:}") String countryCodes) {
        this.clientId = clientId;
        this.secret = secret;
        this.env = env == null || env.isBlank() ? "sandbox" : env.trim().toLowerCase();
        // Banks that sign in on their own website (OAuth: Chase, Bank of America, ...) send the
        // user back here; it must also be listed under Allowed redirect URIs in the Plaid dashboard
        this.redirectUri = redirectUri == null ? "" : redirectUri.trim();
        // Production only allows the countries the Plaid account is approved for (a trial: US)
        this.countryCodes = countryCodes != null && !countryCodes.isBlank()
                ? java.util.Arrays.stream(countryCodes.split(",")).map(String::trim).filter(c -> !c.isEmpty())
                        .map(String::toUpperCase).toList()
                : "sandbox".equals(this.env) ? java.util.List.of("US", "CA", "GB") : java.util.List.of("US");
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
    public String redirectUri() { return redirectUri; }
    public java.util.List<String> countryCodes() { return countryCodes; }
}
