package com.fintrack.auth.service;

import com.fintrack.budgets.repository.BudgetRepository;
import com.fintrack.budgets.repository.GoalRepository;
import com.fintrack.transactions.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Wipes all data for a user before re-seeding.
 *
 * Uses JPQL bulk deletes (not native SQL) so Hibernate applies the correct
 * field-level type mapping — this is what makes the userId comparison work
 * reliably regardless of how the DB column was declared.
 *
 * The single @Transactional on wipeAllUserData is intercepted by Spring's AOP
 * proxy (caller injects this bean, so the call goes through the proxy).
 * All three deletes run inside one transaction and commit together before
 * the caller proceeds to seed new data.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DataWipeService {

    private final TransactionRepository transactionRepository;
    private final BudgetRepository      budgetRepository;
    private final GoalRepository        goalRepository;

    @Transactional
    public void wipeAllUserData(String userId) {
        transactionRepository.deleteAllByUserId(userId);
        budgetRepository.deleteAllByUserId(userId);
        goalRepository.deleteAllByUserId(userId);
        log.info("All data wiped for user {}", userId);
    }
}
