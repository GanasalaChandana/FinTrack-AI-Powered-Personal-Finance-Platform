package com.fintrack.investments;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HoldingRepository extends JpaRepository<Holding, UUID> {
    List<Holding> findByUserIdOrderByNameAsc(String userId);
    Optional<Holding> findByIdAndUserId(UUID id, String userId);
    Optional<Holding> findByUserIdAndExternalId(String userId, String externalId);
    List<Holding> findByPlaidItemId(UUID plaidItemId);

    @Modifying
    @Transactional
    @Query("DELETE FROM Holding h WHERE h.userId = :userId")
    void deleteAllByUserId(String userId);
}
