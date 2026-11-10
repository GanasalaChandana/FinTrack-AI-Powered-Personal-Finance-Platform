package com.fintrack.push;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {
    List<PushSubscription> findByUserId(String userId);
    Optional<PushSubscription> findByEndpoint(String endpoint);

    @Modifying @Transactional
    @Query("DELETE FROM PushSubscription s WHERE s.userId = :userId")
    void deleteAllByUserId(String userId);

    @Modifying @Transactional
    @Query("DELETE FROM PushSubscription s WHERE s.endpoint = :endpoint AND s.userId = :userId")
    int deleteByEndpointAndUserId(String endpoint, String userId);
}
