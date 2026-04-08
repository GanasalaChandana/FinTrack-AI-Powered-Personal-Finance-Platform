package com.fintrack.notifications.controller;

import com.fintrack.notifications.dto.NotificationRequest;
import com.fintrack.notifications.dto.NotificationResponse;
import com.fintrack.notifications.dto.NotificationSettingsDto;
import com.fintrack.notifications.entity.NotificationType;
import com.fintrack.notifications.service.NotificationService;
import com.fintrack.notifications.service.NotificationSettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notifications;
    private final NotificationSettingsService settings;

    /** Rejects request if the X-User-Id header doesn't match the target userId. */
    private ResponseEntity<?> ownershipDenied(String requestingId, String targetId, String endpoint) {
        if (requestingId == null || requestingId.isBlank()) {
            log.warn("{} rejected: missing X-User-Id header", endpoint);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (!requestingId.equals(targetId)) {
            log.warn("{} forbidden: requestingUserId={} tried to access userId={}", endpoint, requestingId, targetId);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return null; // passes
    }

    @PostMapping
    public ResponseEntity<NotificationResponse> createNotification(
            @Valid @RequestBody NotificationRequest req,
            @RequestHeader(value = "X-User-Id", required = false) String requestingUserId) {
        if (requestingUserId == null || requestingUserId.isBlank()) {
            log.warn("POST /api/notifications rejected: missing X-User-Id");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        // Always use the JWT-verified userId — ignore whatever userId is in the body
        if (!requestingUserId.equals(req.userId())) {
            log.warn("POST /api/notifications: overriding body userId={} with verified userId={}",
                    req.userId(), requestingUserId);
        }
        log.debug("Creating notification for userId={}", requestingUserId);
        return ResponseEntity.ok(notifications.createForUser(requestingUserId, req));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<NotificationResponse>> getAllNotifications(
            @PathVariable String userId,
            @RequestHeader(value = "X-User-Id", required = false) String requestingUserId) {
        ResponseEntity<?> check = ownershipDenied(requestingUserId, userId, "GET /notifications/user/" + userId);
        if (check != null) return ResponseEntity.status(check.getStatusCode()).build();
        return ResponseEntity.ok(notifications.list(userId));
    }

    @GetMapping("/user/{userId}/unread")
    public ResponseEntity<List<NotificationResponse>> getUnreadNotifications(
            @PathVariable String userId,
            @RequestHeader(value = "X-User-Id", required = false) String requestingUserId) {
        ResponseEntity<?> check = ownershipDenied(requestingUserId, userId, "GET /notifications/user/" + userId + "/unread");
        if (check != null) return ResponseEntity.status(check.getStatusCode()).build();
        return ResponseEntity.ok(notifications.listUnread(userId));
    }

    @GetMapping("/user/{userId}/type/{type}")
    public ResponseEntity<List<NotificationResponse>> getNotificationsByType(
            @PathVariable String userId,
            @PathVariable NotificationType type,
            @RequestHeader(value = "X-User-Id", required = false) String requestingUserId) {
        ResponseEntity<?> check = ownershipDenied(requestingUserId, userId, "GET /notifications/user/" + userId + "/type/" + type);
        if (check != null) return ResponseEntity.status(check.getStatusCode()).build();
        return ResponseEntity.ok(notifications.listByType(userId, type));
    }

    @GetMapping("/user/{userId}/count/unread")
    public ResponseEntity<Long> getUnreadCount(
            @PathVariable String userId,
            @RequestHeader(value = "X-User-Id", required = false) String requestingUserId) {
        ResponseEntity<?> check = ownershipDenied(requestingUserId, userId, "GET /notifications/user/" + userId + "/count/unread");
        if (check != null) return ResponseEntity.status(check.getStatusCode()).build();
        return ResponseEntity.ok(notifications.unreadCount(userId));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<NotificationResponse> markAsRead(
            @PathVariable UUID id,
            @RequestParam String userId,
            @RequestHeader(value = "X-User-Id", required = false) String requestingUserId) {
        ResponseEntity<?> check = ownershipDenied(requestingUserId, userId, "PATCH /notifications/" + id + "/read");
        if (check != null) return ResponseEntity.status(check.getStatusCode()).build();
        return ResponseEntity.ok(notifications.markRead(id, userId));
    }

    @PatchMapping("/user/{userId}/read-all")
    public ResponseEntity<Void> markAllAsRead(
            @PathVariable String userId,
            @RequestHeader(value = "X-User-Id", required = false) String requestingUserId) {
        ResponseEntity<?> check = ownershipDenied(requestingUserId, userId, "PATCH /notifications/user/" + userId + "/read-all");
        if (check != null) return ResponseEntity.status(check.getStatusCode()).build();
        notifications.markAllRead(userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNotification(
            @PathVariable UUID id,
            @RequestParam String userId,
            @RequestHeader(value = "X-User-Id", required = false) String requestingUserId) {
        ResponseEntity<?> check = ownershipDenied(requestingUserId, userId, "DELETE /notifications/" + id);
        if (check != null) return ResponseEntity.status(check.getStatusCode()).build();
        notifications.delete(id, userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/user/{userId}")
    public ResponseEntity<Void> deleteAllNotifications(
            @PathVariable String userId,
            @RequestHeader(value = "X-User-Id", required = false) String requestingUserId) {
        ResponseEntity<?> check = ownershipDenied(requestingUserId, userId, "DELETE /notifications/user/" + userId);
        if (check != null) return ResponseEntity.status(check.getStatusCode()).build();
        notifications.deleteAll(userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/settings/{userId}")
    public ResponseEntity<NotificationSettingsDto> getNotificationSettings(
            @PathVariable String userId,
            @RequestHeader(value = "X-User-Id", required = false) String requestingUserId) {
        ResponseEntity<?> check = ownershipDenied(requestingUserId, userId, "GET /notifications/settings/" + userId);
        if (check != null) return ResponseEntity.status(check.getStatusCode()).build();
        return ResponseEntity.ok(settings.get(userId));
    }

    @PutMapping("/settings/{userId}")
    public ResponseEntity<NotificationSettingsDto> updateNotificationSettings(
            @PathVariable String userId,
            @Valid @RequestBody NotificationSettingsDto dto,
            @RequestHeader(value = "X-User-Id", required = false) String requestingUserId) {
        ResponseEntity<?> check = ownershipDenied(requestingUserId, userId, "PUT /notifications/settings/" + userId);
        if (check != null) return ResponseEntity.status(check.getStatusCode()).build();
        return ResponseEntity.ok(settings.update(userId, dto));
    }

    @PostMapping("/settings/{userId}/reset")
    public ResponseEntity<NotificationSettingsDto> resetNotificationSettings(
            @PathVariable String userId,
            @RequestHeader(value = "X-User-Id", required = false) String requestingUserId) {
        ResponseEntity<?> check = ownershipDenied(requestingUserId, userId, "POST /notifications/settings/" + userId + "/reset");
        if (check != null) return ResponseEntity.status(check.getStatusCode()).build();
        return ResponseEntity.ok(settings.reset(userId));
    }

    @GetMapping("/health")
    public ResponseEntity<String> healthCheck() {
        return ResponseEntity.ok("Notification service is running");
    }
}
