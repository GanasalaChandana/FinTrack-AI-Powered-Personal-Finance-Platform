package com.fintrack.plaid;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/** What the app sends to Plaid's /link/token/create, against a local fake Plaid. */
@DisplayName("Plaid link token request")
class PlaidLinkTokenTest {

    private final ObjectMapper json = new ObjectMapper();
    private final AtomicReference<JsonNode> sent = new AtomicReference<>();
    private HttpServer fakePlaid;
    private String url;

    @BeforeEach
    void start() throws Exception {
        fakePlaid = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        fakePlaid.createContext("/link/token/create", ex -> {
            sent.set(json.readTree(ex.getRequestBody()));
            byte[] body = "{\"link_token\":\"link-test-123\"}".getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(200, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        fakePlaid.start();
        url = "http://127.0.0.1:" + fakePlaid.getAddress().getPort();
    }

    @AfterEach
    void stop() {
        fakePlaid.stop(0);
    }

    private String linkToken(String env, String redirectUri, String countries) {
        PlaidConfig config = new PlaidConfig("client", "secret", env, url, redirectUri, countries);
        return new PlaidClient(config, json).createLinkToken("user-1", null);
    }

    @Test
    @DisplayName("sandbox: no redirect address, US/CA/GB")
    void sandbox() {
        assertThat(linkToken("sandbox", "", "")).isEqualTo("link-test-123");
        assertThat(sent.get().has("redirect_uri")).isFalse();
        assertThat(sent.get().get("country_codes").toString()).isEqualTo("[\"US\",\"CA\",\"GB\"]");
        assertThat(sent.get().get("user").get("client_user_id").asText()).isEqualTo("user-1");
    }

    @Test
    @DisplayName("production: sends the OAuth return address and only US unless told otherwise")
    void production() {
        linkToken("production", "https://fintrack.example/plaid/oauth", "");
        assertThat(sent.get().get("redirect_uri").asText()).isEqualTo("https://fintrack.example/plaid/oauth");
        assertThat(sent.get().get("country_codes").toString()).isEqualTo("[\"US\"]");

        linkToken("production", "https://fintrack.example/plaid/oauth", " us, ca ");
        assertThat(sent.get().get("country_codes").toString()).isEqualTo("[\"US\",\"CA\"]");
    }

    @Test
    @DisplayName("PLAID_ENV picks Plaid's server")
    void serverPerEnvironment() {
        assertThat(new PlaidConfig("c", "s", "production", "", "", "").baseUrl()).isEqualTo("https://production.plaid.com");
        assertThat(new PlaidConfig("c", "s", " Sandbox ", "", "", "").baseUrl()).isEqualTo("https://sandbox.plaid.com");
    }

    @Test
    @DisplayName("public demo: listed emails get real banks, everyone else Plaid's test banks")
    void demoModes() {
        PlaidConfig demo = new PlaidConfig("client", "prod-secret", "production", "", "https://x/plaid/oauth", "",
                "sandbox-secret", " Me@Example.com , partner@example.com");
        assertThat(demo.modeFor("me@example.com").env()).isEqualTo("production");
        assertThat(demo.modeFor("ME@EXAMPLE.COM").secret()).isEqualTo("prod-secret");
        PlaidConfig.Mode visitor = demo.modeFor("recruiter@company.com");
        assertThat(visitor.env()).isEqualTo("sandbox");
        assertThat(visitor.secret()).isEqualTo("sandbox-secret");
        assertThat(visitor.baseUrl()).isEqualTo("https://sandbox.plaid.com");
        assertThat(demo.modeFor(null).env()).isEqualTo("sandbox");

        // stored connections keep their own environment; older ones ("") use the configured one
        assertThat(demo.modeNamed("sandbox").secret()).isEqualTo("sandbox-secret");
        assertThat(demo.modeNamed("production").secret()).isEqualTo("prod-secret");
        assertThat(demo.modeNamed("").env()).isEqualTo("production");

        // without a sandbox secret everyone gets the configured environment, as before
        PlaidConfig single = new PlaidConfig("client", "prod-secret", "production", "", "", "", "", "me@example.com");
        assertThat(single.modeFor("recruiter@company.com").env()).isEqualTo("production");
        assertThat(single.modeNamed("sandbox")).isNull();

        // a sandbox-only server: everyone sandbox, the demo settings don't matter
        PlaidConfig sandboxOnly = new PlaidConfig("client", "sb", "sandbox", "", "", "", "", "");
        assertThat(sandboxOnly.modeFor("anyone@example.com").env()).isEqualTo("sandbox");
        assertThat(new PlaidConfig("", "", "production", "", "", "", "", "").modeFor("me@example.com")).isNull();
    }

    @Test
    @DisplayName("a demo visitor's link token is made in sandbox with the sandbox secret")
    void visitorLinkTokenGoesToSandbox() {
        PlaidConfig demo = new PlaidConfig("client", "prod-secret", "production", url, "", "", "sandbox-secret", "me@example.com");
        new PlaidClient(demo, json).createLinkToken(demo.modeFor("recruiter@company.com"), "user-2", null);
        assertThat(sent.get().get("secret").asText()).isEqualTo("sandbox-secret");
        assertThat(sent.get().get("country_codes").toString()).isEqualTo("[\"US\",\"CA\",\"GB\"]");
        new PlaidClient(demo, json).createLinkToken(demo.modeFor("me@example.com"), "user-1", null);
        assertThat(sent.get().get("secret").asText()).isEqualTo("prod-secret");
        assertThat(sent.get().get("country_codes").toString()).isEqualTo("[\"US\"]");
    }
}
