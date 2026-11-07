package com.fintrack.budgets.repository;

import com.fintrack.budgets.entity.Budget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface BudgetRepository extends JpaRepository<Budget, Long> {

    List<Budget> findByUserId(String userId);

    List<Budget> findByUserIdAndMonth(String userId, String month);

    List<Budget> findByMonth(String month);

    Optional<Budget> findByUserIdAndCategory(String userId, String category);

    /** JPQL bulk delete — Hibernate resolves the userId field mapping so UUID/VARCHAR cast is handled correctly. */
    @Modifying(clearAutomatically = true)
    @Transactional
    @Query("DELETE FROM Budget b WHERE b.userId = :userId")
    void deleteAllByUserId(@Param("userId") String userId);

    List<Budget> findByHouseholdIdAndMonth(java.util.UUID householdId, String month);

    List<Budget> findByHouseholdId(java.util.UUID householdId);

    /** Make a user's shared budgets personal again (they left or were removed). */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("UPDATE Budget b SET b.householdId = NULL WHERE b.userId = :userId AND b.householdId IS NOT NULL")
    int unshareAllForUser(@org.springframework.data.repository.query.Param("userId") String userId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("UPDATE Budget b SET b.householdId = NULL WHERE b.householdId = :householdId")
    int unshareAllForHousehold(@org.springframework.data.repository.query.Param("householdId") java.util.UUID householdId);
}
