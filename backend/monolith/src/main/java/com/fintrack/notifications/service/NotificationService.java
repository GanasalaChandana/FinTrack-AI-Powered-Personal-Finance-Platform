package com.fintrack.notifications.service;

import com.fintrack.notifications.dto.NotificationRequest;
import com.fintrack.notifications.dto.NotificationResponse;
import com.fintrack.notifications.entity.Notification;
import com.fintrack.notifications.entity.NotificationType;
import com.fintrack.notifications.exception.NotificationNotFoundException;
import com.fintrack.notifications.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class NotificationService {

    private final NotificationRepository repo;

    public NotificationResponse create(NotificationRequest req) {
        return createForUser(req.userId(), req);
    }

    /** Creates a notification, always using the supplied verifiedUserId regardless of what is in the request body. */
    public NotificationResponse createForUser(String verifiedUserId, NotificationRequest req) {
        Notification n = Notification.builder()
                .userId(verifiedUserId)
                .title(req.title())
                .message(req.message())
                .type(req.type())
                .read(false)
                .build();
        return toDto(repo.save(n));
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> list(String userId) {
        return repo.findByUserIdOrderByCreatedAtDesc(userId).stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> listUnread(String userId) {
        return repo.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId).stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> listByType(String userId, NotificationType type) {
        return repo.findByUserIdAndTypeOrderByCreatedAtDesc(userId, type).stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public long unreadCount(String userId) {
        return repo.countByUserIdAndReadFalse(userId);
    }

    public NotificationResponse markRead(UUID id, String userId) {
        Notification n = repo.findById(id).orElseThrow(() -> new NotificationNotFoundException(id));
        if (!n.getUserId().equals(userId))
            throw new NotificationNotFoundException(id);
        n.setRead(true);
        return toDto(n);
    }

    public void markAllRead(String userId) {
        repo.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId)
                .forEach(n -> n.setRead(true));
    }

    public void delete(UUID id, String userId) {
        Notification n = repo.findById(id).orElseThrow(() -> new NotificationNotFoundException(id));
        if (!n.getUserId().equals(userId))
            throw new NotificationNotFoundException(id);
        repo.delete(n);
    }

    public void deleteAll(String userId) {
        repo.findByUserIdOrderByCreatedAtDesc(userId).forEach(repo::delete);
    }

    private NotificationResponse toDto(Notification n) {
        return new NotificationResponse(
                n.getId(), n.getUserId(), n.getTitle(), n.getMessage(),
                n.getType(), n.isRead(), n.getCreatedAt(), n.getUpdatedAt());
    }
}
