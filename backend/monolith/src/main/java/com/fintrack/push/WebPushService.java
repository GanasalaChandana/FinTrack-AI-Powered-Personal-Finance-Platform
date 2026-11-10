package com.fintrack.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fintrack.config.AsyncConfig;
import com.fintrack.plaid.TokenCipher;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Sends Web Push notifications to every device a user turned push on for.
 * The server's VAPID key pair is created on first use and kept in app_settings
 * (private key encrypted), so nothing needs configuring.
 */
@Service
@Slf4j
public class WebPushService {

    static final String PUBLIC_KEY = "push.vapid.public", PRIVATE_KEY = "push.vapid.private";

    private final PushSubscriptionRepository subscriptions;
    private final AppSettingRepository settings;
    private final TokenCipher cipher;
    private final ObjectMapper json;
    private final String subject;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private volatile KeyPair vapid;

    public WebPushService(PushSubscriptionRepository subscriptions, AppSettingRepository settings, ObjectMapper json,
                          @Value("${jwt.secret:}") String jwtSecret,
                          @Value("${app.base-url:https://fintrack-liart.vercel.app}") String appUrl) {
        this.subscriptions = subscriptions;
        this.settings = settings;
        this.json = json;
        this.cipher = new TokenCipher("", "push-vapid|" + jwtSecret);
        this.subject = appUrl.replaceAll("/+$", "");
    }

    public record Message(String title, String body, String url, String tag) {}

    /** The public key browsers subscribe with (base64url). */
    public String publicKey() {
        return WebPushCrypto.b64(WebPushCrypto.rawPublic((ECPublicKey) vapid().getPublic()));
    }

    public PushSubscription subscribe(String userId, String endpoint, String p256dh, String auth) {
        if (endpoint == null || !endpoint.startsWith("https://") || endpoint.length() > 1000) {
            throw new IllegalArgumentException("Invalid push endpoint");
        }
        // Validate the browser's keys now rather than at the first send
        if (WebPushCrypto.unb64(auth).length != 16) throw new IllegalArgumentException("Invalid push auth secret");
        WebPushCrypto.publicKey(WebPushCrypto.unb64(p256dh));
        PushSubscription s = subscriptions.findByEndpoint(endpoint).orElseGet(PushSubscription::new);
        s.setUserId(userId); // a device belongs to whoever subscribed it last
        s.setEndpoint(endpoint);
        s.setP256dh(p256dh);
        s.setAuth(auth);
        if (s.getCreatedAt() == null) s.setCreatedAt(LocalDateTime.now());
        return subscriptions.save(s);
    }

    public boolean unsubscribe(String userId, String endpoint) {
        return subscriptions.deleteByEndpointAndUserId(endpoint, userId) > 0;
    }

    public int deviceCount(String userId) {
        return subscriptions.findByUserId(userId).size();
    }

    /** In the background; never throws. */
    @Async(AsyncConfig.MAIL_EXECUTOR)
    public void notifyUser(String userId, Message m) {
        sendNow(userId, m);
    }

    /** Sends to every device of the user; returns how many accepted it. */
    public int sendNow(String userId, Message m) {
        if (userId == null) return 0;
        List<PushSubscription> devices = subscriptions.findByUserId(userId);
        if (devices.isEmpty()) return 0;
        byte[] payload;
        try {
            Map<String, String> p = new LinkedHashMap<>();
            p.put("title", m.title());
            p.put("body", m.body());
            p.put("url", m.url() == null ? "/dashboard" : m.url());
            if (m.tag() != null) p.put("tag", m.tag());
            payload = json.writeValueAsBytes(p);
        } catch (Exception e) {
            log.warn("Couldn't build push payload: {}", e.getMessage());
            return 0;
        }
        int sent = 0;
        for (PushSubscription s : devices) {
            if (deliver(s, payload)) sent++;
        }
        return sent;
    }

    private boolean deliver(PushSubscription s, byte[] payload) {
        try {
            URI endpoint = URI.create(s.getEndpoint());
            String audience = endpoint.getScheme() + "://" + endpoint.getHost()
                    + (endpoint.getPort() > 0 ? ":" + endpoint.getPort() : "");
            long exp = System.currentTimeMillis() / 1000 + 12 * 3600;
            byte[] body = WebPushCrypto.encrypt(payload, WebPushCrypto.unb64(s.getP256dh()), WebPushCrypto.unb64(s.getAuth()));
            HttpRequest req = HttpRequest.newBuilder(endpoint)
                    .timeout(Duration.ofSeconds(15))
                    .header("TTL", "86400")
                    .header("Urgency", "normal")
                    .header("Content-Encoding", "aes128gcm")
                    .header("Content-Type", "application/octet-stream")
                    .header("Authorization", WebPushCrypto.vapidAuthorization(audience, subject, vapid(), exp))
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            int code = res.statusCode();
            if (code >= 200 && code < 300) return true;
            if (code == 404 || code == 410) {
                subscriptions.delete(s); // the browser unsubscribed or the subscription expired
                log.info("Removed expired push subscription {}", s.getId());
            } else {
                log.warn("Push to subscription {} failed: HTTP {} {}", s.getId(), code,
                        res.body() == null ? "" : res.body().substring(0, Math.min(200, res.body().length())));
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("Push to subscription {} failed: {}", s.getId(), e.getMessage());
        }
        return false;
    }

    /** The server's key pair: loaded from app_settings, or created and stored on first use. */
    synchronized KeyPair vapid() {
        if (vapid != null) return vapid;
        var pub = settings.findById(PUBLIC_KEY);
        var priv = settings.findById(PRIVATE_KEY);
        if (pub.isPresent() && priv.isPresent()) {
            try {
                ECPublicKey p = WebPushCrypto.publicKey(WebPushCrypto.unb64(pub.get().getValue()));
                ECPrivateKey k = WebPushCrypto.privateKey(WebPushCrypto.unb64(cipher.decrypt(priv.get().getValue())));
                return vapid = new KeyPair(p, k);
            } catch (Exception e) {
                // e.g. JWT_SECRET changed: the old key can't be read, and subscriptions made
                // with it are useless; start over (browsers re-subscribe on their next visit)
                log.warn("Push keys unreadable ({}); creating new ones", e.getMessage());
                subscriptions.deleteAll();
            }
        }
        KeyPair kp = WebPushCrypto.newKeyPair();
        settings.save(new AppSetting(PUBLIC_KEY, WebPushCrypto.b64(WebPushCrypto.rawPublic((ECPublicKey) kp.getPublic()))));
        settings.save(new AppSetting(PRIVATE_KEY, cipher.encrypt(WebPushCrypto.b64(WebPushCrypto.rawPrivate((ECPrivateKey) kp.getPrivate())))));
        log.info("Created the server's push (VAPID) key pair");
        return vapid = kp;
    }
}
