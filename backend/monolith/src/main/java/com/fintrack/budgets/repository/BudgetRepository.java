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

    Optional<Budget> findByUserIdAndCategory(String userId, String category);

    /** Immediate SQL DELETE — bypasses JPA persistence context so deletes flush before re-seed. */
    @Modifying(clearAutomatically = true)
    @Transactional
    @Query(value = "DELETE FROM budgets WHERE user_id = :userId", nativeQuery = true)
    void deleteAllByUserId(@Param("userId") String userId);
}
