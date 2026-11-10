package com.fintrack.push;

import com.fintrack.common.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Settings → Notifications: push notifications on this device. */
@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {

    private final WebPushService push;

    /** The key browsers subscribe with, and how many of the user's devices have push on. */
    @GetMapping("/config")
    public Map<String, Object> config(@RequestHeader("X-User-Id") String userId) {
        return Map.of("publicKey", push.publicKey(), "devices", push.deviceCount(userId));
    }

    /** The browser's PushSubscription.toJSON(); it also carries expirationTime, which isn't needed. */
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    public record SubscribeRequest(String endpoint, Keys keys) {
        @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
        public record Keys(String p256dh, String auth) {}
    }

    @PostMapping("/subscriptions")
    public ResponseEntity<Void> subscribe(@RequestHeader("X-User-Id") String userId, @RequestBody SubscribeRequest req) {
        if (req == null || req.keys() == null) throw new BadRequestException("Missing push subscription");
        try {
            push.subscribe(userId, req.endpoint(), req.keys().p256dh(), req.keys().auth());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException(e.getMessage());
        }
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/subscriptions")
    public ResponseEntity<Void> unsubscribe(@RequestHeader("X-User-Id") String userId, @RequestBody Map<String, String> body) {
        push.unsubscribe(userId, body == null ? null : body.get("endpoint"));
        return ResponseEntity.noContent().build();
    }

    /** Sends a test notification to all of the user's devices. */
    @PostMapping("/test")
    public Map<String, Integer> test(@RequestHeader("X-User-Id") String userId) {
        int sent = push.sendNow(userId, new WebPushService.Message(
                "FinTrack notifications are on",
                "You'll get budget and large-transaction alerts here.",
                "/settings?tab=notifications", "fintrack-test"));
        return Map.of("sent", sent);
    }
}
