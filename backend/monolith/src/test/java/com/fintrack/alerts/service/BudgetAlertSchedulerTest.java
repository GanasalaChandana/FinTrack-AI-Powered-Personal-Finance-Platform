package com.fintrack.alerts.service;

import com.fintrack.budgets.entity.Budget;
import com.fintrack.budgets.repository.BudgetRepository;
import com.fintrack.budgets.service.BudgetsService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.YearMonth;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("BudgetAlertScheduler")
class BudgetAlertSchedulerTest {

    @Mock private AlertService alertService;
    @Mock private BudgetRepository budgetRepository;
    @Mock private BudgetsService budgetsService;
    @InjectMocks private BudgetAlertScheduler scheduler;

    private Budget budget(String category, double limit, double spent) {
        return Budget.builder().userId("u1").category(category).budget(limit).spent(spent)
                .month(YearMonth.now().toString()).isActive(true).build();
    }

    @Test
    @DisplayName("creates a warning at 80% and an exceeded alert over 100% for this month's budgets")
    void createsAlerts() {
        Budget food = budget("Food", 500, 425);       // 85%
        Budget fun  = budget("Entertainment", 100, 120); // 120%
        Budget rent = budget("Housing", 1500, 300);   // 20% → nothing
        when(budgetRepository.findByMonth(YearMonth.now().toString())).thenReturn(List.of(food, fun, rent));
        when(budgetsService.syncSpent(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));

        scheduler.checkBudgetAlerts();

        verify(alertService).createAlertIfNotExists(eq("u1"), eq("Food"), eq("WARNING_80"), anyString(), anyString(), eq("MEDIUM"));
        verify(alertService).createAlertIfNotExists(eq("u1"), eq("Entertainment"), eq("EXCEEDED_100"), anyString(), anyString(), eq("HIGH"));
        verify(alertService, never()).createAlertIfNotExists(any(), eq("Housing"), any(), any(), any(), any());
    }

    @Test
    @DisplayName("uses spending synced from transactions, not the stored value")
    void usesSyncedSpent() {
        Budget stale = budget("Food", 500, 0);
        when(budgetRepository.findByMonth(anyString())).thenReturn(List.of(stale));
        when(budgetsService.syncSpent(stale)).thenReturn(budget("Food", 500, 600));

        scheduler.checkBudgetAlerts();

        verify(alertService).createAlertIfNotExists(eq("u1"), eq("Food"), eq("EXCEEDED_100"), anyString(), anyString(), eq("HIGH"));
    }
}
