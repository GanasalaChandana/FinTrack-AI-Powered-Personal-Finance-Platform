package com.fintrack.transactions.repository;

import com.fintrack.transactions.entity.ImportJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

public interface ImportJobRepository extends JpaRepository<ImportJob, UUID> {

    Optional<ImportJob> findByIdAndUserId(UUID id, String userId);

    /** Bulk delete for account deletion. */
    @Modifying
    @Transactional
    @Query("DELETE FROM ImportJob j WHERE j.userId = :userId")
    int deleteAllByUserId(@Param("userId") String userId);
}
