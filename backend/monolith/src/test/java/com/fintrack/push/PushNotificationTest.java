package com.fintrack.push;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Push notifications")
class PushNotificationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private WebPushService push;
    @Autowired private PushSubscriptionRepository subs;

    private HttpServer fakePushService;
    private final List<Map<String, Object>> received = Collections.synchronizedList(new ArrayList<>());
    private volatile int replyStatus = 201;
    private static final AtomicInteger ip = new AtomicInteger(1);

    @BeforeEach
    void startFakePushService() throws Exception {
        fakePushService = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        fakePushService.createContext("/", ex -> {
            Map<String, Object> r = new HashMap<>();
            r.put("authorization", ex.getRequestHeaders().getFirst("Authorization"));
            r.put("encoding", ex.getRequestHeaders().getFirst("Content-Encoding"));
            r.put("ttl", ex.getRequestHeaders().getFirst("TTL"));
            r.put("body", ex.getRequestBody().readAllBytes());
            received.add(r);
            ex.sendResponseHeaders(replyStatus, -1);
            ex.close();
        });
        fakePushService.start();
    }

    @AfterEach
    void stop() {
        fakePushService.stop(0);
    }

    private String signup() throws Exception {
        var r = mvc.perform(post("/api/auth/register").header("X-Forwarded-For", "203.0.113.2" + ip.getAndIncrement() % 50)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"push-" + UUID.randomUUID() + "@test.dev\",\"password\":\"Secret123!\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + r.getResponse().getCookie("ft_at").getValue();
    }

    @Test
    @DisplayName("a device subscribes, gets an encrypted, signed notification, and is removed once it expires")
    void endToEnd() throws Exception {
        String bearer = signup();
        JsonNode cfg = json.readTree(mvc.perform(get("/api/push/config").header("Authorization", bearer))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        byte[] serverKey = WebPushCrypto.unb64(cfg.get("publicKey").asText());
        assertThat(serverKey).hasSize(65);
        assertThat(cfg.get("devices").asInt()).isZero();

        // The "browser": its own key pair and auth secret
        KeyPair device = WebPushCrypto.newKeyPair();
        byte[] auth = new byte[16];
        new Random(7).nextBytes(auth);
        String p256dh = WebPushCrypto.b64(WebPushCrypto.rawPublic((ECPublicKey) device.getPublic()));

        // Real endpoints must be https; bad keys are refused
        mvc.perform(post("/api/push/subscriptions").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endpoint\":\"http://insecure.example/x\",\"keys\":{\"p256dh\":\"" + p256dh + "\",\"auth\":\"" + WebPushCrypto.b64(auth) + "\"}}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/push/subscriptions").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endpoint\":\"https://push.example/abc\",\"keys\":{\"p256dh\":\"AAAA\",\"auth\":\"" + WebPushCrypto.b64(auth) + "\"}}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/push/subscriptions").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                        // exactly what browsers send: PushSubscription.toJSON(), with expirationTime
                        .content("{\"endpoint\":\"https://push.example/abc\",\"expirationTime\":null,\"keys\":{\"p256dh\":\"" + p256dh + "\",\"auth\":\"" + WebPushCrypto.b64(auth) + "\"}}"))
                .andExpect(status().isNoContent());

        // Point that subscription at the local fake push service (tests can't reach real ones)
        PushSubscription s = subs.findByEndpoint("https://push.example/abc").orElseThrow();
        String endpoint = "http://127.0.0.1:" + fakePushService.getAddress().getPort() + "/send/abc";
        s.setEndpoint(endpoint);
        subs.save(s);

        mvc.perform(post("/api/push/test").header("Authorization", bearer)).andExpect(jsonPath("$.sent").value(1));
        assertThat(received).hasSize(1);
        Map<String, Object> got = received.get(0);
        assertThat(got.get("encoding")).isEqualTo("aes128gcm");
        assertThat(got.get("ttl")).isEqualTo("86400");

        // The push service checks the VAPID token with the key it carries
        String authz = (String) got.get("authorization");
        String jwt = authz.substring(authz.indexOf("t=") + 2, authz.indexOf(','));
        String k = authz.substring(authz.indexOf("k=") + 2).trim();
        assertThat(WebPushCrypto.unb64(k)).isEqualTo(serverKey);
        String[] parts = jwt.split("\\.");
        Signature verify = Signature.getInstance("SHA256withECDSAinP1363Format");
        verify.initVerify(WebPushCrypto.publicKey(serverKey));
        verify.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        assertThat(verify.verify(WebPushCrypto.unb64(parts[2]))).isTrue();
        JsonNode claims = json.readTree(WebPushCrypto.unb64(parts[1]));
        assertThat(claims.get("aud").asText()).isEqualTo("http://127.0.0.1:" + fakePushService.getAddress().getPort());

        // Only the device can read the message
        JsonNode message = json.readTree(decrypt((byte[]) got.get("body"), device, auth));
        assertThat(message.get("title").asText()).contains("notifications are on");
        assertThat(message.get("url").asText()).isEqualTo("/settings?tab=notifications");

        // The browser unsubscribed: the push service says 410 Gone, and the device is forgotten
        replyStatus = 410;
        mvc.perform(post("/api/push/test").header("Authorization", bearer)).andExpect(jsonPath("$.sent").value(0));
        assertThat(subs.findByEndpoint(endpoint)).isEmpty();
    }

    @Test
    @DisplayName("the server key pair is created once and reused")
    void stableKeys() {
        assertThat(push.publicKey()).isEqualTo(push.publicKey());
    }

    /** The browser's side of RFC 8291, written independently of WebPushCrypto.encrypt. */
    private static byte[] decrypt(byte[] body, KeyPair device, byte[] authSecret) throws Exception {
        ByteBuffer b = ByteBuffer.wrap(body);
        byte[] salt = new byte[16];
        b.get(salt);
        b.getInt(); // record size
        byte[] asPublic = new byte[b.get()];
        b.get(asPublic);
        byte[] ciphertext = new byte[b.remaining()];
        b.get(ciphertext);

        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
        ka.init(device.getPrivate());
        ka.doPhase(WebPushCrypto.publicKey(asPublic), true);
        byte[] ecdh = ka.generateSecret();
        byte[] uaPublic = WebPushCrypto.rawPublic((ECPublicKey) device.getPublic());

        byte[] prkKey = hmac(authSecret, ecdh);
        byte[] ikm = hmac(prkKey, cat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), uaPublic, asPublic, new byte[]{1}));
        byte[] prk = hmac(salt, ikm);
        byte[] cek = Arrays.copyOf(hmac(prk, cat("Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), new byte[]{1})), 16);
        byte[] nonce = Arrays.copyOf(hmac(prk, cat("Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), new byte[]{1})), 12);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] padded = c.doFinal(ciphertext);
        int end = padded.length - 1;
        while (padded[end] == 0) end--;          // strip padding
        assertThat(padded[end]).isEqualTo((byte) 2); // last-record delimiter
        return Arrays.copyOf(padded, end);
    }

    private static byte[] hmac(byte[] key, byte[] data) throws Exception {
        Mac m = Mac.getInstance("HmacSHA256");
        m.init(new SecretKeySpec(key, "HmacSHA256"));
        return m.doFinal(data);
    }

    private static byte[] cat(byte[]... parts) {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        for (byte[] p : parts) o.writeBytes(p);
        return o.toByteArray();
    }
}
