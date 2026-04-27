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
 * Separate Spring bean so Spring's AOP proxy intercepts the call and
 * REQUIRES_NEW propagation actually takes effect — a private method on
 * DemoService cannot be proxied, so the wipe must live here.
 *
 * REQUIRES_NEW: opens its own transaction, commits it fully, then returns.
 * The caller's seed operations start only after this commit — no mixing possible.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DataWipeService {

    private final TransactionRepository transactionRepository;
    private final BudgetRepository      budgetRepository;
    private final GoalRepository        goalRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void wipeAllUserData(String userId) {
        transactionRepository.deleteAllByUserId(userId);
        budgetRepository.deleteAllByUserId(userId);
        goalRepository.deleteAllByUserId(userId);
        log.info("🗑️  Hard-wiped all data for user {} — transaction will commit before seed", userId);
    }
}
