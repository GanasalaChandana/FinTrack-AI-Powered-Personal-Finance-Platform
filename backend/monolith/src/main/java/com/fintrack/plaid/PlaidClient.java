package com.fintrack.plaid;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** The few Plaid API calls FinTrack makes (plain REST, no SDK). */
@Component
public class PlaidClient {

    /** A Plaid API error, e.g. ITEM_LOGIN_REQUIRED. */
    public static class PlaidException extends RuntimeException {
        private final String code;
        public PlaidException(String code, String message) { super(message); this.code = code; }
        public String code() { return code; }
    }

    private final PlaidConfig config;
    private final ObjectMapper json;
    private final RestClient http;

    public PlaidClient(PlaidConfig config, ObjectMapper json) {
        this.config = config;
        this.json = json;
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(10_000);
        f.setReadTimeout(30_000);
        this.http = RestClient.builder().baseUrl(config.baseUrl()).requestFactory(f).build();
    }

    public String createLinkToken(String userId, String webhookUrl) {
        Map<String, Object> body = new HashMap<>();
        body.put("client_name", "FinTrack");
        body.put("language", "en");
        body.put("country_codes", List.of("US", "CA", "GB"));
        body.put("user", Map.of("client_user_id", userId));
        body.put("products", List.of("transactions"));
        body.put("transactions", Map.of("days_requested", 180));
        if (webhookUrl != null && !webhookUrl.isBlank()) body.put("webhook", webhookUrl);
        return post("/link/token/create", body).path("link_token").asText();
    }

    /** Returns [access_token, item_id]. */
    public String[] exchangePublicToken(String publicToken) {
        JsonNode r = post("/item/public_token/exchange", Map.of("public_token", publicToken));
        return new String[] { r.path("access_token").asText(), r.path("item_id").asText() };
    }

    /** One page of /transactions/sync. */
    public JsonNode transactionsSync(String accessToken, String cursor) {
        Map<String, Object> body = new HashMap<>();
        body.put("access_token", accessToken);
        body.put("count", 250);
        if (cursor != null && !cursor.isBlank()) body.put("cursor", cursor);
        return post("/transactions/sync", body);
    }

    public void removeItem(String accessToken) {
        post("/item/remove", Map.of("access_token", accessToken));
    }

    private JsonNode post(String path, Map<String, Object> body) {
        Map<String, Object> withAuth = new HashMap<>(body);
        withAuth.put("client_id", config.clientId());
        withAuth.put("secret", config.secret());
        try {
            String res = http.post().uri(path).contentType(MediaType.APPLICATION_JSON)
                    .body(withAuth).retrieve().body(String.class);
            return json.readTree(res == null ? "{}" : res);
        } catch (RestClientResponseException e) {
            String code = "PLAID_ERROR", msg = "Plaid request failed (" + e.getStatusCode().value() + ")";
            try {
                JsonNode err = json.readTree(e.getResponseBodyAsString());
                code = err.path("error_code").asText(code);
                msg = err.path("error_message").asText(msg);
            } catch (Exception ignored) { /* not JSON */ }
            throw new PlaidException(code, msg);
        } catch (PlaidException e) {
            throw e;
        } catch (Exception e) {
            throw new PlaidException("PLAID_UNREACHABLE", "Couldn't reach Plaid: " + e.getMessage());
        }
    }
}
