package com.fintrack.alerts.service;

import com.fintrack.budgets.entity.Budget;
import com.fintrack.budgets.repository.BudgetRepository;
import com.fintrack.budgets.service.BudgetsService;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.YearMonth;
import java.util.List;

/**
 * Hourly check that creates "80% used" / "exceeded" alerts for this month's budgets.
 *
 * Reads budgets straight from the database. It used to call a budgets
 * microservice over HTTP (/budgets/all-with-spending), which doesn't exist in
 * the monolith, so every run failed and no budget alerts were ever created.
 */
@Service
@Slf4j
public class BudgetAlertScheduler {

    private final AlertService alertService;
    private final BudgetRepository budgetRepository;
    private final BudgetsService budgetsService;
    private final com.fintrack.notifications.service.NotificationEmailService notificationEmails;

    public BudgetAlertScheduler(AlertService alertService, BudgetRepository budgetRepository,
                                BudgetsService budgetsService,
                                com.fintrack.notifications.service.NotificationEmailService notificationEmails) {
        this.alertService = alertService;
        this.budgetRepository = budgetRepository;
        this.budgetsService = budgetsService;
        this.notificationEmails = notificationEmails;
    }

    @Scheduled(fixedDelay = 3600000, initialDelay = 300000) // hourly, first run 5 min after start-up
    @SchedulerLock(name = "budgetAlerts", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void checkBudgetAlerts() {
        checkBudgetAlertsNow();
    }

    /** The work of the hourly job, without its lock. */
    public void checkBudgetAlertsNow() {
        log.info("Running budget alert check...");
        try {
            List<Budget> budgets = budgetRepository.findByMonth(YearMonth.now().toString());

            if (budgets == null || budgets.isEmpty()) {
                log.info("No budgets found to check");
                return;
            }

            for (Budget b : budgets) {
                try {
                    if (Boolean.FALSE.equals(b.getIsActive())) continue;
                    Budget budget = budgetsService.syncSpent(b); // spent from actual transactions
                    String userId = budget.getUserId();
                    String category = budget.getCategory();
                    if (userId == null || category == null)
                        continue;

                    double budgetAmount = budget.getBudget() != null ? budget.getBudget() : 0;
                    double spent = budget.getSpent() != null ? budget.getSpent() : 0;

                    if (budgetAmount <= 0)
                        continue;

                    double percentage = (spent / budgetAmount) * 100;

                    // No currency symbol: the user's currency is a display setting in the browser
                    String title = null, message = null, type = null, severity = null;
                    if (percentage >= 100) {
                        type = "EXCEEDED_100"; severity = "HIGH";
                        title = "Budget Exceeded: " + category;
                        message = String.format("You've exceeded your %s budget by %,.2f (spent %,.2f of %,.2f)",
                                category, spent - budgetAmount, spent, budgetAmount);
                    } else if (percentage >= 80) {
                        type = "WARNING_80"; severity = "MEDIUM";
                        title = "Budget Warning: " + category;
                        message = String.format("You've used %.0f%% of your %s budget (%,.2f of %,.2f)",
                                percentage, category, spent, budgetAmount);
                    }
                    if (type != null && alertService.createAlertIfNotExists(userId, category, type, title, message, severity)) {
                        notificationEmails.budgetAlert(userId, title, message); // only for new alerts
                    }
                } catch (Exception e) {
                    log.warn("Error processing budget alert: {}", e.getMessage());
                }
            }
            log.info("Budget alert check complete");
        } catch (Exception e) {
            log.error("Budget alert check failed: {}", e.getMessage());
        }
    }
}
