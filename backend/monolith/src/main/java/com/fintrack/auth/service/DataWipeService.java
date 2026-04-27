package com.fintrack.auth.service;

import com.fintrack.budgets.repository.BudgetRepository;
import com.fintrack.budgets.repository.GoalRepository;
import com.fintrack.transactions.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Isolated wipe service — lives in its own Spring bean so AOP proxying works.
 *
 * Each delete method uses REQUIRES_NEW so it opens, executes, and COMMITS
 * its own database transaction before returning. The caller has no outer
 * transaction to interfere with, so there is no connection-pool deadlock
 * and no flush-ordering ambiguity. Seed inserts can only start after all
 * three commits have landed.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DataWipeService {

    private final TransactionRepository transactionRepository;
    private final BudgetRepository      budgetRepository;
    private final GoalRepository        goalRepository;

    /** Deletes all three tables for a user, each in its own committed transaction. */
    public void wipeAllUserData(String userId) {
        deleteTransactions(userId);
        deleteBudgets(userId);
        deleteGoals(userId);
        log.info("🗑️  All data wiped for user {} — 3 commits completed", userId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deleteTransactions(String userId) {
        transactionRepository.deleteAllByUserId(userId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deleteBudgets(String userId) {
        budgetRepository.deleteAllByUserId(userId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deleteGoals(String userId) {
        goalRepository.deleteAllByUserId(userId);
    }
}
