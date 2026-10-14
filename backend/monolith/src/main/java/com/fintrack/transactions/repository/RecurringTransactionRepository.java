package com.fintrack.transactions.repository;

import com.fintrack.transactions.entity.RecurringTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface RecurringTransactionRepository extends JpaRepository<RecurringTransaction, Long> {

    Page<RecurringTransaction> findByUserId(String userId, Pageable pageable);

    Optional<RecurringTransaction> findByIdAndUserId(Long id, String userId);

    @Query("SELECT r FROM RecurringTransaction r WHERE r.active = true " +
           "AND r.nextOccurrence <= :date " +
           "AND (r.endDate IS NULL OR r.endDate >= :date)")
    List<RecurringTransaction> findDueRecurringTransactions(LocalDate date);

    /** Bulk delete for account deletion. */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("DELETE FROM RecurringTransaction e WHERE e.userId = :userId")
    int deleteAllByUserIdForAccountDeletion(@org.springframework.data.repository.query.Param("userId") String userId);
}
