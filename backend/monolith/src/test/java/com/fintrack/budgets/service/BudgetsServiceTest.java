package com.fintrack.budgets.service;

import com.fintrack.budgets.entity.Budget;
import com.fintrack.budgets.exception.ResourceNotFoundException;
import com.fintrack.budgets.exception.UnauthorizedException;
import com.fintrack.budgets.repository.BudgetRepository;
import com.fintrack.transactions.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for BudgetsService.
 * Uses Mockito — no Spring context, no database.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("BudgetsService")
class BudgetsServiceTest {

    @Mock
    private BudgetRepository budgetRepository;

    @Mock
    private TransactionRepository transactionRepository;

    @InjectMocks
    private BudgetsService budgetsService;

    private static final String USER_ID   = "user-123";
    private static final String OTHER_USER = "user-999";
    private static final String CATEGORY  = "Food & Dining";
    private static final String MONTH     = YearMonth.now().toString(); // e.g. "2026-04"

    private Budget buildBudget(Long id, String userId, Double budgetAmt, Double spent) {
        return Budget.builder()
                .id(id)
                .userId(userId)
                .category(CATEGORY)
                .budget(budgetAmt)
                .spent(spent)
                .month(MONTH)
                .icon("🍔")
                .color("#3b82f6")
                .period("monthly")
                .isActive(true)
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // syncSpent
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("syncSpent()")
    class SyncSpentTests {

        @Test
        @DisplayName("updates spent when transaction total differs from stored value")
        void syncSpent_updatesWhenDifferent() {
            Budget budget = buildBudget(1L, USER_ID, 500.0, 0.0);
            when(transactionRepository.sumExpensesByCategoryAndMonth(USER_ID, CATEGORY, MONTH))
                    .thenReturn(new BigDecimal("150.00"));
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));

            Budget result = budgetsService.syncSpent(budget);

            assertThat(result.getSpent()).isEqualTo(150.0);
            verify(budgetRepository).save(budget);
        }

        @Test
        @DisplayName("skips save when spent value already matches transactions")
        void syncSpent_skipsWhenAlreadyInSync() {
            Budget budget = buildBudget(1L, USER_ID, 500.0, 150.0);
            when(transactionRepository.sumExpensesByCategoryAndMonth(USER_ID, CATEGORY, MONTH))
                    .thenReturn(new BigDecimal("150.00"));

            budgetsService.syncSpent(budget);

            verify(budgetRepository, never()).save(any());
        }

        @Test
        @DisplayName("treats null repository result as zero spent")
        void syncSpent_treatsNullAsZero() {
            Budget budget = buildBudget(1L, USER_ID, 300.0, 50.0);
            when(transactionRepository.sumExpensesByCategoryAndMonth(USER_ID, CATEGORY, MONTH))
                    .thenReturn(null);
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));

            Budget result = budgetsService.syncSpent(budget);

            assertThat(result.getSpent()).isZero();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // createBudget
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("createBudget()")
    class CreateBudgetTests {

        @Test
        @DisplayName("applies defaults when icon, color, and month are null")
        void createBudget_appliesDefaults() {
            Budget input = Budget.builder()
                    .userId(USER_ID)
                    .category(CATEGORY)
                    .budget(200.0)
                    .build();

            Budget saved = buildBudget(10L, USER_ID, 200.0, 0.0);
            when(budgetRepository.save(any())).thenReturn(saved);
            when(transactionRepository.sumExpensesByCategoryAndMonth(anyString(), anyString(), anyString()))
                    .thenReturn(BigDecimal.ZERO);

            Budget result = budgetsService.createBudget(input);

            // defaults filled in before save
            verify(budgetRepository).save(argThat(b ->
                    b.getIcon() != null && !b.getIcon().isEmpty() &&
                    b.getColor() != null && !b.getColor().isEmpty() &&
                    b.getMonth() != null && !b.getMonth().isEmpty()
            ));
            assertThat(result).isNotNull();
        }

        @Test
        @DisplayName("preserves explicit icon and color when provided")
        void createBudget_preservesExplicitValues() {
            Budget input = Budget.builder()
                    .userId(USER_ID).category(CATEGORY).budget(300.0)
                    .icon("🚗").color("#ff0000").month(MONTH)
                    .build();

            when(budgetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(transactionRepository.sumExpensesByCategoryAndMonth(anyString(), anyString(), anyString()))
                    .thenReturn(BigDecimal.ZERO);

            Budget result = budgetsService.createBudget(input);

            assertThat(result.getIcon()).isEqualTo("🚗");
            assertThat(result.getColor()).isEqualTo("#ff0000");
        }

        @Test
        @DisplayName("immediately syncs spent from transactions after creation")
        void createBudget_syncsSpentImmediately() {
            Budget input = buildBudget(null, USER_ID, 500.0, 0.0);
            Budget saved = buildBudget(5L, USER_ID, 500.0, 0.0);
            when(budgetRepository.save(any())).thenReturn(saved);
            when(transactionRepository.sumExpensesByCategoryAndMonth(USER_ID, CATEGORY, MONTH))
                    .thenReturn(new BigDecimal("75.50"));

            budgetsService.createBudget(input);

            // transactionRepository must be called to sync spent
            verify(transactionRepository).sumExpensesByCategoryAndMonth(USER_ID, CATEGORY, MONTH);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // getBudgetById
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getBudgetById()")
    class GetBudgetByIdTests {

        @Test
        @DisplayName("returns budget when user owns it")
        void getBudgetById_returnsOwnedBudget() {
            Budget budget = buildBudget(1L, USER_ID, 400.0, 100.0);
            when(budgetRepository.findById(1L)).thenReturn(Optional.of(budget));
            when(transactionRepository.sumExpensesByCategoryAndMonth(anyString(), anyString(), anyString()))
                    .thenReturn(new BigDecimal("100.00"));

            Budget result = budgetsService.getBudgetById("1", USER_ID);

            assertThat(result).isNotNull();
            assertThat(result.getUserId()).isEqualTo(USER_ID);
        }

        @Test
        @DisplayName("throws ResourceNotFoundException for missing budget")
        void getBudgetById_throwsNotFound() {
            when(budgetRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> budgetsService.getBudgetById("99", USER_ID))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Budget not found");
        }

        @Test
        @DisplayName("throws UnauthorizedException when user does not own budget")
        void getBudgetById_throwsUnauthorizedForWrongUser() {
            Budget budget = buildBudget(1L, USER_ID, 400.0, 0.0);
            when(budgetRepository.findById(1L)).thenReturn(Optional.of(budget));

            assertThatThrownBy(() -> budgetsService.getBudgetById("1", OTHER_USER))
                    .isInstanceOf(UnauthorizedException.class);
        }

        @Test
        @DisplayName("throws ResourceNotFoundException for non-numeric ID")
        void getBudgetById_throwsForNonNumericId() {
            assertThatThrownBy(() -> budgetsService.getBudgetById("not-a-number", USER_ID))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Invalid budget ID");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // deleteBudget
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("deleteBudget()")
    class DeleteBudgetTests {

        @Test
        @DisplayName("deletes budget owned by user")
        void deleteBudget_deletesOwned() {
            Budget budget = buildBudget(1L, USER_ID, 200.0, 0.0);
            when(budgetRepository.findById(1L)).thenReturn(Optional.of(budget));
            when(transactionRepository.sumExpensesByCategoryAndMonth(anyString(), anyString(), anyString()))
                    .thenReturn(BigDecimal.ZERO);
            doNothing().when(budgetRepository).delete(budget);

            budgetsService.deleteBudget("1", USER_ID);

            verify(budgetRepository).delete(budget);
        }

        @Test
        @DisplayName("throws UnauthorizedException when deleting someone else's budget")
        void deleteBudget_throwsForWrongUser() {
            Budget budget = buildBudget(1L, USER_ID, 200.0, 0.0);
            when(budgetRepository.findById(1L)).thenReturn(Optional.of(budget));

            assertThatThrownBy(() -> budgetsService.deleteBudget("1", OTHER_USER))
                    .isInstanceOf(UnauthorizedException.class);

            verify(budgetRepository, never()).delete(any());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // getBudgetSummary
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getBudgetSummary()")
    class BudgetSummaryTests {

        @Test
        @DisplayName("calculates totals, remaining, and percentage correctly")
        void getBudgetSummary_correctMath() {
            List<Budget> budgets = List.of(
                    buildBudget(1L, USER_ID, 500.0, 200.0),
                    buildBudget(2L, USER_ID, 300.0, 150.0)
            );
            when(budgetRepository.findByUserIdAndMonth(USER_ID, MONTH)).thenReturn(budgets);
            when(transactionRepository.sumExpensesByCategoryAndMonth(anyString(), anyString(), anyString()))
                    .thenReturn(BigDecimal.ZERO); // sync returns same values

            // Override with values that match spent
            budgets.forEach(b -> when(
                    transactionRepository.sumExpensesByCategoryAndMonth(USER_ID, b.getCategory(), MONTH))
                    .thenReturn(BigDecimal.valueOf(b.getSpent())));

            Map<String, Object> summary = budgetsService.getBudgetSummary(USER_ID, MONTH);

            assertThat(summary).containsKey("totalBudget");
            assertThat(summary).containsKey("totalSpent");
            assertThat(summary).containsKey("remaining");
            assertThat(summary).containsKey("percentage");
            assertThat((Double) summary.get("totalBudget")).isEqualTo(800.0);
        }

        @Test
        @DisplayName("uses current month when month param is null")
        void getBudgetSummary_defaultsToCurrentMonth() {
            when(budgetRepository.findByUserIdAndMonth(eq(USER_ID), anyString())).thenReturn(List.of());

            budgetsService.getBudgetSummary(USER_ID, null);

            // Should call findByUserIdAndMonth with current month, not null
            verify(budgetRepository).findByUserIdAndMonth(eq(USER_ID), eq(MONTH));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // getAllBudgetsByUserId
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getAllBudgetsByUserId()")
    class GetAllBudgetsTests {

        @Test
        @DisplayName("filters by month when provided")
        void getAllBudgets_filtersByMonth() {
            when(budgetRepository.findByUserIdAndMonth(USER_ID, MONTH)).thenReturn(List.of());

            budgetsService.getAllBudgetsByUserId(USER_ID, MONTH);

            verify(budgetRepository).findByUserIdAndMonth(USER_ID, MONTH);
            verify(budgetRepository, never()).findByUserId(any());
        }

        @Test
        @DisplayName("fetches all budgets when month is null")
        void getAllBudgets_noMonthFilter() {
            when(budgetRepository.findByUserId(USER_ID)).thenReturn(List.of());

            budgetsService.getAllBudgetsByUserId(USER_ID, null);

            verify(budgetRepository).findByUserId(USER_ID);
            verify(budgetRepository, never()).findByUserIdAndMonth(any(), any());
        }
    }
}
