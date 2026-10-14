package com.fintrack.alerts.repository;

import com.fintrack.alerts.entity.AlertHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface AlertHistoryRepository extends JpaRepository<AlertHistory, UUID> {

       List<AlertHistory> findByUserId(UUID userId);

       Page<AlertHistory> findByUserId(UUID userId, Pageable pageable);

       List<AlertHistory> findByUserIdAndIsReadFalse(UUID userId);

       List<AlertHistory> findByUserIdAndAlertType(UUID userId, AlertHistory.AlertType alertType);

       List<AlertHistory> findByUserIdAndCreatedAtBetween(UUID userId, LocalDateTime start, LocalDateTime end);

       long countByUserIdAndIsReadFalse(UUID userId);

    /** Bulk delete for account deletion. */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("DELETE FROM AlertHistory e WHERE e.userId = :userId")
    int deleteAllByUserIdForAccountDeletion(@org.springframework.data.repository.query.Param("userId") java.util.UUID userId);
}
