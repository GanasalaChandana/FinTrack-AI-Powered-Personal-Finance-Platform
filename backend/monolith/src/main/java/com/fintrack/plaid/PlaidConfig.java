package com.fintrack.plaid;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Plaid settings: PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV (sandbox | development |
 * production). Bank connections are off until the client id and secret are set.
 *
 * Public demo with production keys: set PLAID_SANDBOX_SECRET too, and list the people who
 * get real banks in PLAID_PRODUCTION_EMAILS; everyone else uses Plaid's test banks, so
 * visitors (recruiters, testers) never use up paid or limited production connections.
 */
@Component
public class PlaidConfig {

    private final String clientId;
    private final String secret;
    private final String env;
    private final String baseUrl;
    private final String redirectUri;
    private final java.util.List<String> countryCodes;
    private final String sandboxSecret;
    private final java.util.Set<String> productionEmails;
    private final String baseUrlOverride;

    /** Which Plaid environment a request goes to, and with which secret. */
    public record Mode(String env, String baseUrl, String secret, java.util.List<String> countryCodes) {}

    public PlaidConfig(@Value("${plaid.client-id:}") String clientId,
                       @Value("${plaid.secret:}") String secret,
                       @Value("${plaid.env:sandbox}") String env,
                       @Value("${plaid.base-url:}") String baseUrlOverride,
                       @Value("${plaid.redirect-uri:}") String redirectUri,
                       @Value("${plaid.country-codes:}") String countryCodes) {
        this(clientId, secret, env, baseUrlOverride, redirectUri, countryCodes, "", "");
    }

    @org.springframework.beans.factory.annotation.Autowired
    public PlaidConfig(@Value("${plaid.client-id:}") String clientId,
                       @Value("${plaid.secret:}") String secret,
                       @Value("${plaid.env:sandbox}") String env,
                       @Value("${plaid.base-url:}") String baseUrlOverride,
                       @Value("${plaid.redirect-uri:}") String redirectUri,
                       @Value("${plaid.country-codes:}") String countryCodes,
                       @Value("${plaid.sandbox-secret:}") String sandboxSecret,
                       @Value("${plaid.production-emails:}") String productionEmails) {
        this.sandboxSecret = sandboxSecret == null ? "" : sandboxSecret.trim();
        this.productionEmails = productionEmails == null || productionEmails.isBlank() ? java.util.Set.of()
                : java.util.Arrays.stream(productionEmails.split(",")).map(e -> e.trim().toLowerCase())
                        .filter(e -> !e.isEmpty()).collect(java.util.stream.Collectors.toUnmodifiableSet());
        this.baseUrlOverride = baseUrlOverride == null ? "" : baseUrlOverride.replaceAll("/+$", "");
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

    private Mode main() {
        return new Mode(env, baseUrl, secret, countryCodes);
    }

    private Mode sandbox() {
        if ("sandbox".equals(env)) return main();
        if (sandboxSecret.isBlank()) return null;
        String url = baseUrlOverride.isBlank() ? "https://sandbox.plaid.com" : baseUrlOverride;
        return new Mode("sandbox", url, sandboxSecret, java.util.List.of("US", "CA", "GB"));
    }

    /**
     * The mode for a user: production only for listed emails when a sandbox secret is set
     * (the public demo), otherwise the configured environment for everyone. Null when off.
     */
    public Mode modeFor(String email) {
        if (!isEnabled()) return null;
        if (!"production".equals(env) || sandboxSecret.isBlank()) return main();
        boolean listed = email != null && productionEmails.contains(email.trim().toLowerCase());
        return listed ? main() : sandbox();
    }

    /** The mode a stored connection was made in ("" for connections from before modes existed). */
    public Mode modeNamed(String name) {
        if (!isEnabled()) return null;
        if (name == null || name.isBlank() || name.equals(env)) return main();
        return "sandbox".equals(name) ? sandbox() : null;
    }
}
