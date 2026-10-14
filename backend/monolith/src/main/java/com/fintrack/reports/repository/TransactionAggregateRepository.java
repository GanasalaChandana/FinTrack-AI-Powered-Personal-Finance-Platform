package com.fintrack.reports.repository;

import com.fintrack.reports.entity.TransactionAggregate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface TransactionAggregateRepository extends JpaRepository<TransactionAggregate, UUID> {

    List<TransactionAggregate> findByUserIdAndAggregationDateBetween(
        UUID userId, LocalDate startDate, LocalDate endDate
    );

    List<TransactionAggregate> findByUserIdAndCategoryAndAggregationDateBetween(
        UUID userId, String category, LocalDate startDate, LocalDate endDate
    );

    @Query("SELECT ta FROM TransactionAggregate ta " +
           "WHERE ta.userId = :userId " +
           "AND ta.aggregationDate BETWEEN :startDate AND :endDate " +
           "ORDER BY ta.aggregationDate")
    List<TransactionAggregate> findByUserIdAndDateRange(
        @Param("userId") UUID userId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );

    @Query("SELECT ta.category, SUM(ta.totalAmount) as total, SUM(ta.transactionCount) as count " +
           "FROM TransactionAggregate ta " +
           "WHERE ta.userId = :userId " +
           "AND ta.aggregationDate BETWEEN :startDate AND :endDate " +
           "AND ta.category IS NOT NULL " +
           "GROUP BY ta.category " +
           "ORDER BY total DESC")
    List<Object[]> findCategoryTotals(
        @Param("userId") UUID userId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );

    /** Bulk delete for account deletion. */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("DELETE FROM TransactionAggregate e WHERE e.userId = :userId")
    int deleteAllByUserIdForAccountDeletion(@org.springframework.data.repository.query.Param("userId") java.util.UUID userId);
}
