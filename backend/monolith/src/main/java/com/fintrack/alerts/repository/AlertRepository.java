package com.fintrack.alerts.repository;

import com.fintrack.alerts.entity.Alert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AlertRepository extends JpaRepository<Alert, Long> {

    List<Alert> findByUserId(String userId);

    List<Alert> findByStatus(String status);

    List<Alert> findByUserIdAndStatus(String userId, String status);

    List<Alert> findByType(String type);

    List<Alert> findByReadFalse();

    List<Alert> findByUserIdAndReadFalse(String userId);

    boolean existsByUserIdAndCategoryAndTypeAndCreatedAtAfter(
            String userId, String category, String type, LocalDateTime date);

    /** Bulk delete for account deletion. */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("DELETE FROM Alert e WHERE e.userId = :userId")
    int deleteAllByUserIdForAccountDeletion(@org.springframework.data.repository.query.Param("userId") String userId);
}
