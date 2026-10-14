package com.fintrack.alerts.repository;

import com.fintrack.alerts.entity.AlertRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AlertRuleRepository extends JpaRepository<AlertRule, UUID> {

    List<AlertRule> findByUserIdAndIsActiveTrue(UUID userId);

    List<AlertRule> findByUserId(UUID userId);

    List<AlertRule> findByUserIdAndRuleType(UUID userId, AlertRule.RuleType ruleType);

    /** Bulk delete for account deletion. */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("DELETE FROM AlertRule e WHERE e.userId = :userId")
    int deleteAllByUserIdForAccountDeletion(@org.springframework.data.repository.query.Param("userId") java.util.UUID userId);
}
