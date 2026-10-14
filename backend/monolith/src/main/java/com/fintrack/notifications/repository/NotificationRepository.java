package com.fintrack.notifications.repository;

import com.fintrack.notifications.entity.Notification;
import com.fintrack.notifications.entity.NotificationType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(String userId);

    List<Notification> findByUserIdAndReadFalseOrderByCreatedAtDesc(String userId);

    long countByUserIdAndReadFalse(String userId);

    List<Notification> findByUserIdAndTypeOrderByCreatedAtDesc(String userId, NotificationType type);

    /** Bulk delete for account deletion. */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("DELETE FROM Notification e WHERE e.userId = :userId")
    int deleteAllByUserIdForAccountDeletion(@org.springframework.data.repository.query.Param("userId") String userId);
}
