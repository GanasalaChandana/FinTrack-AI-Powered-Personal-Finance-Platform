package com.fintrack.auth.service;

import com.fintrack.alerts.repository.AlertHistoryRepository;
import com.fintrack.alerts.repository.AlertRepository;
import com.fintrack.alerts.repository.AlertRuleRepository;
import com.fintrack.auth.repository.RefreshTokenRepository;
import com.fintrack.auth.repository.UserRepository;
import com.fintrack.budgets.repository.BudgetRepository;
import com.fintrack.budgets.repository.GoalRepository;
import com.fintrack.notifications.repository.NotificationRepository;
import com.fintrack.notifications.repository.NotificationSettingsRepository;
import com.fintrack.reports.repository.ReportHistoryRepository;
import com.fintrack.reports.repository.ScheduledReportRepository;
import com.fintrack.reports.repository.SpendingSummaryCacheRepository;
import com.fintrack.reports.repository.TransactionAggregateRepository;
import com.fintrack.transactions.repository.RecurringTransactionRepository;
import com.fintrack.transactions.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Deletes an account and everything that belongs to it, in one transaction.
 *
 * Deleting only the user row left all of their financial data behind, and it
 * failed outright for anyone who had logged in: refresh tokens reference the
 * user with a foreign key.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AccountDeletionService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final TransactionRepository transactionRepository;
    private final RecurringTransactionRepository recurringTransactionRepository;
    private final BudgetRepository budgetRepository;
    private final GoalRepository goalRepository;
    private final AlertRepository alertRepository;
    private final AlertHistoryRepository alertHistoryRepository;
    private final AlertRuleRepository alertRuleRepository;
    private final NotificationRepository notificationRepository;
    private final NotificationSettingsRepository notificationSettingsRepository;
    private final ReportHistoryRepository reportHistoryRepository;
    private final ScheduledReportRepository scheduledReportRepository;
    private final SpendingSummaryCacheRepository spendingSummaryCacheRepository;
    private final TransactionAggregateRepository transactionAggregateRepository;

    @Transactional
    public void deleteAccount(UUID userId) {
        String id = userId.toString();

        transactionRepository.deleteAllByUserId(id);
        recurringTransactionRepository.deleteAllByUserIdForAccountDeletion(id);
        budgetRepository.deleteAllByUserId(id);
        goalRepository.deleteAllByUserId(id);
        alertRepository.deleteAllByUserIdForAccountDeletion(id);
        alertHistoryRepository.deleteAllByUserIdForAccountDeletion(userId);
        alertRuleRepository.deleteAllByUserIdForAccountDeletion(userId);
        notificationRepository.deleteAllByUserIdForAccountDeletion(id);
        notificationSettingsRepository.findById(id).ifPresent(notificationSettingsRepository::delete);
        reportHistoryRepository.deleteAllByUserIdForAccountDeletion(userId);
        scheduledReportRepository.deleteAllByUserIdForAccountDeletion(userId);
        spendingSummaryCacheRepository.deleteAllByUserIdForAccountDeletion(userId);
        transactionAggregateRepository.deleteAllByUserIdForAccountDeletion(userId);

        refreshTokenRepository.deleteAllByUserId(userId); // FK to users — must go before the user
        userRepository.deleteById(userId);

        log.info("Account {} and all its data deleted", id);
    }
}
