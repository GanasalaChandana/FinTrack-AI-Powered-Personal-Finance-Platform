package com.fintrack.reports.repository;

import com.fintrack.reports.entity.ReportHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ReportHistoryRepository extends JpaRepository<ReportHistory, UUID> {

    List<ReportHistory> findByUserId(UUID userId);

    @Query("SELECT r FROM ReportHistory r WHERE r.userId = :userId AND r.status = :status")
    List<ReportHistory> findByUserIdAndStatus(
        @Param("userId") UUID userId,
        @Param("status") ReportHistory.ReportStatus status
    );

    /** Bulk delete for account deletion. */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("DELETE FROM ReportHistory e WHERE e.userId = :userId")
    int deleteAllByUserIdForAccountDeletion(@org.springframework.data.repository.query.Param("userId") java.util.UUID userId);
}
