package com.fintrack.transactions.repository;

import com.fintrack.transactions.entity.CategoryRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

public interface CategoryRuleRepository extends JpaRepository<CategoryRule, Long> {

    Optional<CategoryRule> findByUserIdAndMerchantKey(String userId, String merchantKey);

    /** Bulk delete for account deletion. */
    @Modifying
    @Transactional
    @Query("DELETE FROM CategoryRule r WHERE r.userId = :userId")
    int deleteAllByUserId(@Param("userId") String userId);
}
