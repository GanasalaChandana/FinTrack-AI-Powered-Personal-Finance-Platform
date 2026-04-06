package com.fintrack.budgets.service;

import com.fintrack.budgets.entity.Budget;
import com.fintrack.budgets.exception.ResourceNotFoundException;
import com.fintrack.budgets.exception.UnauthorizedException;
import com.fintrack.budgets.repository.BudgetRepository;
import com.fintrack.transactions.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class BudgetsService {

    private final BudgetRepository budgetRepository;
    private final TransactionRepository transactionRepository;

    // ─── Auto-sync helper ────────────────────────────────────────────────────

    /**
     * Recalculates the 'spent' field of a budget by summing EXPENSE transactions
     * for the same userId, category (case-insensitive), and month (YYYY-MM).
     * Persists the updated value and returns the updated budget.
     */
    @Transactional
    public Budget syncSpent(Budget budget) {
        try {
            String month = budget.getMonth() != null
                    ? budget.getMonth()
                    : YearMonth.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));

            BigDecimal spent = transactionRepository.sumExpensesByCategoryAndMonth(
                    budget.getUserId(), budget.getCategory(), month);

            double spentValue = spent != null ? spent.doubleValue() : 0.0;

            if (!Double.valueOf(spentValue).equals(budget.getSpent())) {
                budget.setSpent(spentValue);
                budget = budgetRepository.save(budget);
                log.info("✅ Synced budget '{}' for user {}: spent = {}",
                        budget.getCategory(), budget.getUserId(), spentValue);
            }
        } catch (Exception e) {
            log.error("⚠️ Failed to sync spent for budget {}: {}", budget.getId(), e.getMessage());
        }
        return budget;
    }

    /**
     * Sync all budgets for a user and return updated list.
     */
    @Transactional
    public List<Budget> syncAllSpent(List<Budget> budgets) {
        return budgets.stream().map(this::syncSpent).toList();
    }

    // ─── CRUD ────────────────────────────────────────────────────────────────

    public List<Budget> getAllBudgetsByUserId(String userId, String month) {
        List<Budget> budgets;
        if (month != null && !month.isEmpty()) {
            budgets = budgetRepository.findByUserIdAndMonth(userId, month);
        } else {
            budgets = budgetRepository.findByUserId(userId);
        }
        // Auto-sync spent from actual transactions on every fetch
        return syncAllSpent(budgets);
    }

    public Optional<Budget> getBudgetByCategory(String userId, String category) {
        return budgetRepository.findByUserIdAndCategory(userId, category);
    }

    public Budget getBudgetById(String id, String userId) {
        Long budgetId;
        try {
            budgetId = Long.parseLong(id);
        } catch (NumberFormatException e) {
            throw new ResourceNotFoundException("Invalid budget ID: " + id);
        }

        Budget budget = budgetRepository.findById(budgetId)
                .orElseThrow(() -> new ResourceNotFoundException("Budget not found"));

        if (!budget.getUserId().equals(userId)) {
            throw new UnauthorizedException("You don't have permission to access this budget");
        }

        // Sync spent from actual transactions
        return syncSpent(budget);
    }

    @Transactional
    public Budget createBudget(Budget budget) {
        // Set default values if not provided
        if (budget.getSpent() == null) {
            budget.setSpent(0.0);
        }
        if (budget.getIcon() == null || budget.getIcon().isEmpty()) {
            budget.setIcon("💰");
        }
        if (budget.getColor() == null || budget.getColor().isEmpty()) {
            budget.setColor("#3b82f6");
        }
        if (budget.getMonth() == null || budget.getMonth().isEmpty()) {
            budget.setMonth(YearMonth.now().format(DateTimeFormatter.ofPattern("yyyy-MM")));
        }
        if (budget.getIsActive() == null) {
            budget.setIsActive(true);
        }

        // Auto-calculate start and end dates from period (month)
        if (budget.getMonth() != null && budget.getStartDate() == null) {
            String[] parts = budget.getMonth().split("-");
            int year = Integer.parseInt(parts[0]);
            int month = Integer.parseInt(parts[1]);

            // First day of the month at 00:00:00
            budget.setStartDate(LocalDateTime.of(year, month, 1, 0, 0, 0));

            // Last day of the month at 23:59:59
            YearMonth yearMonth = YearMonth.of(year, month);
            budget.setEndDate(LocalDateTime.of(year, month, yearMonth.lengthOfMonth(), 23, 59, 59));
        }

        Budget saved = budgetRepository.save(budget);
        // Immediately sync spent from existing transactions for this category/month
        return syncSpent(saved);
    }

    @Transactional
    public Budget updateBudget(String id, Budget budgetUpdate, String userId) {
        Budget budget = getBudgetById(id, userId);

        if (budgetUpdate.getCategory() != null) {
            budget.setCategory(budgetUpdate.getCategory());
        }
        if (budgetUpdate.getBudget() != null) {
            budget.setBudget(budgetUpdate.getBudget());
        }
        if (budgetUpdate.getSpent() != null) {
            budget.setSpent(budgetUpdate.getSpent());
        }
        if (budgetUpdate.getIcon() != null) {
            budget.setIcon(budgetUpdate.getIcon());
        }
        if (budgetUpdate.getColor() != null) {
            budget.setColor(budgetUpdate.getColor());
        }
        if (budgetUpdate.getMonth() != null) {
            budget.setMonth(budgetUpdate.getMonth());

            // Recalculate start and end dates if month is updated
            String[] parts = budgetUpdate.getMonth().split("-");
            int year = Integer.parseInt(parts[0]);
            int month = Integer.parseInt(parts[1]);

            budget.setStartDate(LocalDateTime.of(year, month, 1, 0, 0, 0));
            YearMonth yearMonth = YearMonth.of(year, month);
            budget.setEndDate(LocalDateTime.of(year, month, yearMonth.lengthOfMonth(), 23, 59, 59));
        }

        return budgetRepository.save(budget);
    }

    @Transactional
    public Budget updateSpent(String id, Double spent, String userId) {
        Budget budget = getBudgetById(id, userId);
        budget.setSpent(spent);
        return budgetRepository.save(budget);
    }

    @Transactional
    public void deleteBudget(String id, String userId) {
        Budget budget = getBudgetById(id, userId);
        budgetRepository.delete(budget);
    }

    public Map<String, Object> getBudgetSummary(String userId, String month) {
        String targetMonth = month != null ? month : YearMonth.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));

        // Sync spent from transactions before computing summary
        List<Budget> budgets = syncAllSpent(budgetRepository.findByUserIdAndMonth(userId, targetMonth));

        double totalBudget = budgets.stream()
                .mapToDouble(Budget::getBudget)
                .sum();

        double totalSpent = budgets.stream()
                .mapToDouble(Budget::getSpent)
                .sum();

        double remaining = totalBudget - totalSpent;
        double percentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

        return Map.of(
                "month", targetMonth,
                "totalBudget", totalBudget,
                "totalSpent", totalSpent,
                "remaining", remaining,
                "percentage", Math.round(percentage * 100.0) / 100.0,
                "budgets", budgets);
    }
}
