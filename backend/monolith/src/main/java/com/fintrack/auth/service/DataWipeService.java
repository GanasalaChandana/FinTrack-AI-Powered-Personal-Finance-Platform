package com.fintrack.auth.service;

import com.fintrack.budgets.entity.Budget;
import com.fintrack.budgets.entity.Goal;
import com.fintrack.budgets.repository.BudgetRepository;
import com.fintrack.budgets.repository.GoalRepository;
import com.fintrack.transactions.entity.Transaction;
import com.fintrack.transactions.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Isolated wipe service — separate Spring bean so AOP proxying applies.
 *
 * Strategy: use findByUserId (proven to work in the app) to load entities,
 * then deleteAllInBatch which issues DELETE WHERE id IN (...) using primary
 * keys — completely bypasses the VARCHAR vs UUID type-mismatch that causes
 * native "WHERE user_id = :userId" to silently delete 0 rows.
 *
 * Each table gets its own REQUIRES_NEW transaction so it commits independently
 * before the next table and before any seed inserts begin.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DataWipeService {

    private final TransactionRepository transactionRepository;
    private final BudgetRepository      budgetRepository;
    private final GoalRepository        goalRepository;

    public void wipeAllUserData(String userId) {
        deleteTransactions(userId);
        deleteBudgets(userId);
        deleteGoals(userId);
        log.info("🗑️  All data wiped for user {}", userId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deleteTransactions(String userId) {
        List<Transaction> txns = transactionRepository.findByUserId(userId);
        if (!txns.isEmpty()) {
            transactionRepository.deleteAllInBatch(txns);
            log.info("🗑️  Deleted {} transactions for user {}", txns.size(), userId);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deleteBudgets(String userId) {
        List<Budget> budgets = budgetRepository.findByUserId(userId);
        if (!budgets.isEmpty()) {
            budgetRepository.deleteAllInBatch(budgets);
            log.info("🗑️  Deleted {} budgets for user {}", budgets.size(), userId);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deleteGoals(String userId) {
        List<Goal> goals = goalRepository.findByUserId(userId);
        if (!goals.isEmpty()) {
            goalRepository.deleteAllInBatch(goals);
            log.info("🗑️  Deleted {} goals for user {}", goals.size(), userId);
        }
    }
}
