package com.fintrack.reports;

import com.fintrack.auth.entity.User;
import com.fintrack.auth.security.JwtUtil;
import com.fintrack.budgets.entity.Budget;
import com.fintrack.budgets.repository.BudgetRepository;
import com.fintrack.transactions.entity.Transaction;
import com.fintrack.transactions.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Reports read real data, and one user can never read another's transactions. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Reports")
class ReportsIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private TransactionRepository transactions;
    @Autowired private BudgetRepository budgets;

    private String alice, bob, aliceToken, bobToken;

    // These tests sign tokens for users that aren't in the database; the
    // revocation check itself is covered by TokenRevocationTest.
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    private com.fintrack.auth.security.TokenRevocationService tokenRevocationService;

    @BeforeEach
    void seed() {
        org.mockito.Mockito.when(tokenRevocationService.isCurrent(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyInt())).thenReturn(true);
        alice = UUID.randomUUID().toString();
        bob = UUID.randomUUID().toString();
        aliceToken = token(alice);
        bobToken = token(bob);
        LocalDate today = LocalDate.now();
        tx(alice, "Whole Foods", "Food & Dining", "EXPENSE", 450, today);
        tx(alice, "Employer", "Salary", "INCOME", 3000, today);
        tx(bob, "Secret Clinic", "Healthcare", "EXPENSE", 999, today);
        budgets.save(Budget.builder().userId(alice).category("Food & Dining").budget(300.0).spent(0.0)
                .month(YearMonth.now().toString()).isActive(true).build());
    }

    private String token(String userId) {
        return "Bearer " + jwtUtil.generateToken(User.builder().id(UUID.fromString(userId)).email(userId + "@t.dev").build());
    }

    private void tx(String user, String merchant, String category, String type, double amount, LocalDate date) {
        Transaction t = new Transaction();
        t.setUserId(user); t.setMerchant(merchant); t.setDescription(merchant); t.setCategory(category);
        t.setType(type); t.setAmount(BigDecimal.valueOf(amount)); t.setDate(date);
        transactions.save(t);
    }

    @Test
    @DisplayName("top expenses come from the user's real transactions (were always empty)")
    void topExpenses_realData() throws Exception {
        mockMvc.perform(get("/api/reports/top-expenses").header("Authorization", aliceToken))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Whole Foods")))
                .andExpect(content().string(not(containsString("Secret Clinic"))));
    }

    @Test
    @DisplayName("category breakdown uses the user's real budget, not an invented $1,000")
    void categoryBreakdown_realBudget() throws Exception {
        mockMvc.perform(get("/api/reports/category-breakdown").header("Authorization", aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.name == 'Food & Dining')].budget", contains(300.0)));
    }

    @Test
    @DisplayName("insights flag the over-budget category")
    void insights_overBudget() throws Exception {
        mockMvc.perform(get("/api/reports/insights").header("Authorization", aliceToken))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Food & Dining is 50% over budget")));
    }

    @Test
    @DisplayName("a user can't read someone else's transactions by putting their id in the URL")
    void transactionReports_otherUser_forbidden() throws Exception {
        String from = LocalDate.now().minusDays(1).toString(), to = LocalDate.now().plusDays(1).toString();
        for (String path : new String[]{"/api/transactions/reports", "/api/transactions/reports/totals",
                                        "/api/transactions/reports/categories"}) {
            mockMvc.perform(get(path).param("userId", bob).param("startDate", from).param("endDate", to)
                            .header("Authorization", aliceToken))
                    .andExpect(status().isForbidden());
        }
        mockMvc.perform(get("/api/transactions/reports/by-type").param("userId", bob).param("type", "EXPENSE")
                        .param("startDate", from).param("endDate", to).header("Authorization", aliceToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/budgets/category").param("userId", alice).param("category", "Food & Dining")
                        .header("Authorization", bobToken))
                .andExpect(status().isForbidden());
        // and their own still works
        mockMvc.perform(get("/api/transactions/reports").param("userId", bob).param("startDate", from).param("endDate", to)
                        .header("Authorization", bobToken))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Secret Clinic")));
    }

    @Test
    @DisplayName("monthly data is in calendar order, one entry per month")
    void monthlyData_inCalendarOrder() throws Exception {
        String carol = UUID.randomUUID().toString();
        YearMonth now = YearMonth.now();
        // Inserted out of order on purpose
        tx(carol, "Shop", "Shopping", "EXPENSE", 30, now.minusMonths(1).atDay(5));
        tx(carol, "Shop", "Shopping", "EXPENSE", 10, now.minusMonths(3).atDay(5));
        tx(carol, "Shop", "Shopping", "EXPENSE", 20, now.minusMonths(2).atDay(5));

        boolean spansYears = now.minusMonths(3).getYear() != now.minusMonths(1).getYear();
        java.util.function.Function<YearMonth, String> label = ym -> {
            String n = ym.getMonth().getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.ENGLISH);
            return spansYears ? n + " " + String.valueOf(ym.getYear()).substring(2) : n;
        };

        mockMvc.perform(get("/api/reports/financial").param("range", "last-year").header("Authorization", token(carol)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.monthlyData[*].month", contains(
                        label.apply(now.minusMonths(3)), label.apply(now.minusMonths(2)), label.apply(now.minusMonths(1)))))
                .andExpect(jsonPath("$.monthlyData[*].expenses", contains(10.0, 20.0, 30.0)));
    }

    @Test
    @DisplayName("no period-over-period change when history doesn't cover the previous period")
    void noChange_withoutEnoughHistory() throws Exception {
        String dave = UUID.randomUUID().toString();
        tx(dave, "Employer", "Salary", "INCOME", 3000, LocalDate.now().minusDays(3));
        tx(dave, "Shop", "Shopping", "EXPENSE", 500, LocalDate.now().minusDays(2));

        mockMvc.perform(get("/api/reports/financial").param("range", "last-year").header("Authorization", token(dave)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.savingsRate").value(greaterThan(0.0)))
                .andExpect(jsonPath("$.summary.incomeChange").value(0))
                .andExpect(jsonPath("$.summary.savingsRateChange").value(0));
    }
}
