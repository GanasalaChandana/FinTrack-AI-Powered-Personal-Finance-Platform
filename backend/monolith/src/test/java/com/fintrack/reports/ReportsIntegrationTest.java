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

    @BeforeEach
    void seed() {
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
}
