package com.fintrack.transactions.repository;

import com.fintrack.transactions.entity.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    // ========== EXISTING METHODS ==========

    Page<Transaction> findByUserId(String userId, Pageable pageable);

    Optional<Transaction> findByIdAndUserId(Long id, String userId);

    void deleteByIdAndUserId(Long id, String userId);

    @Query(value = "SELECT t.* FROM public.transactions t WHERE t.user_id = :userId " +
            "AND (:type IS NULL OR t.type = :type) " +
            "AND (:category IS NULL OR t.category = :category) " +
            "AND (:startDate IS NULL OR t.date >= :startDate) " +
            "AND (:endDate IS NULL OR t.date <= :endDate) " +
            "AND (:search IS NULL OR LOWER(CAST(t.description AS TEXT)) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "     OR LOWER(CAST(t.merchant AS TEXT)) LIKE LOWER(CONCAT('%', :search, '%')))" +
            "ORDER BY t.date DESC", countQuery = "SELECT COUNT(*) FROM public.transactions t WHERE t.user_id = :userId "
                    +
                    "AND (:type IS NULL OR t.type = :type) " +
                    "AND (:category IS NULL OR t.category = :category) " +
                    "AND (:startDate IS NULL OR t.date >= :startDate) " +
                    "AND (:endDate IS NULL OR t.date <= :endDate) " +
                    "AND (:search IS NULL OR LOWER(CAST(t.description AS TEXT)) LIKE LOWER(CONCAT('%', :search, '%')) "
                    +
                    "     OR LOWER(CAST(t.merchant AS TEXT)) LIKE LOWER(CONCAT('%', :search, '%')))", nativeQuery = true)
    Page<Transaction> findByFilters(
            @Param("userId") String userId,
            @Param("type") String type,
            @Param("category") String category,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("search") String search,
            Pageable pageable);

    // ========== NEW METHODS FOR REPORTS SERVICE ==========

    /**
     * Find transactions by user and date range
     * Used by Reports Service to get transactions for analysis
     */
    @Query(value = "SELECT * FROM public.transactions t WHERE t.user_id = :userId " +
            "AND t.date BETWEEN :startDate AND :endDate ORDER BY t.date DESC", nativeQuery = true)
    List<Transaction> findByUserIdAndDateBetween(
            @Param("userId") String userId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * Find transactions by user, date range and type (INCOME/EXPENSE)
     * Useful for calculating totals by type
     */
    @Query(value = "SELECT * FROM public.transactions t WHERE t.user_id = :userId " +
            "AND t.date BETWEEN :startDate AND :endDate " +
            "AND t.type = :type ORDER BY t.date DESC", nativeQuery = true)
    List<Transaction> findByUserIdAndDateBetweenAndType(
            @Param("userId") String userId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("type") String type);

    /**
     * Get total amount by type for a user in a date range
     * Fast aggregation query for reports
     */
    @Query(value = "SELECT COALESCE(SUM(t.amount), 0) FROM public.transactions t " +
            "WHERE t.user_id = :userId AND t.type = :type " +
            "AND t.date BETWEEN :startDate AND :endDate", nativeQuery = true)
    java.math.BigDecimal getTotalByTypeAndDateRange(
            @Param("userId") String userId,
            @Param("type") String type,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * Find all transactions for a user (without pagination)
     * Used for comprehensive reports
     */
    List<Transaction> findByUserId(String userId);

    /** Immediate SQL DELETE — bypasses JPA persistence context so deletes flush before re-seed. */
    @Modifying
    @Transactional
    @Query(value = "DELETE FROM transactions WHERE user_id = :userId", nativeQuery = true)
    void deleteAllByUserId(@Param("userId") String userId);

    /**
     * Get transactions grouped by category for a date range
     * Optimized for category breakdown reports
     */
    @Query(value = "SELECT t.category, COUNT(*) as count, SUM(t.amount) as total " +
            "FROM public.transactions t " +
            "WHERE t.user_id = :userId " +
            "AND t.type = 'EXPENSE' " +
            "AND t.date BETWEEN :startDate AND :endDate " +
            "GROUP BY t.category " +
            "ORDER BY total DESC", nativeQuery = true)
    List<Object[]> getCategoryTotals(
            @Param("userId") String userId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * Sum EXPENSE transactions for a specific user, category, and month (YYYY-MM).
     * Case-insensitive category match. Used for auto-syncing budget spent amounts.
     */
    @Query(value = "SELECT COALESCE(SUM(t.amount), 0) FROM public.transactions t " +
            "WHERE t.user_id = :userId " +
            "AND t.type = 'EXPENSE' " +
            "AND LOWER(t.category) = LOWER(:category) " +
            "AND TO_CHAR(t.date, 'YYYY-MM') = :month", nativeQuery = true)
    java.math.BigDecimal sumExpensesByCategoryAndMonth(
            @Param("userId") String userId,
            @Param("category") String category,
            @Param("month") String month);
}
