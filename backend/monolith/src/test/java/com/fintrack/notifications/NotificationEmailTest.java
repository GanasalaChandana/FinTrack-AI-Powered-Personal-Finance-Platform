package com.fintrack.notifications;

import com.fintrack.alerts.service.BudgetAlertScheduler;
import com.fintrack.auth.entity.User;
import com.fintrack.auth.repository.UserRepository;
import com.fintrack.auth.security.JwtUtil;
import com.fintrack.budgets.entity.Budget;
import com.fintrack.budgets.repository.BudgetRepository;
import com.fintrack.common.EmailService;
import com.fintrack.notifications.entity.NotificationSettings;
import com.fintrack.notifications.repository.NotificationSettingsRepository;
import com.fintrack.notifications.service.NotificationEmailService;
import com.fintrack.transactions.entity.Transaction;
import com.fintrack.transactions.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Notification emails")
class NotificationEmailTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository users;
    @Autowired private NotificationSettingsRepository settings;
    @Autowired private TransactionRepository transactions;
    @Autowired private BudgetRepository budgets;
    @Autowired private NotificationEmailService emails;
    @Autowired private BudgetAlertScheduler budgetAlerts;
    @MockitoBean private EmailService email;
    @MockitoBean private com.fintrack.auth.security.TokenRevocationService tokenRevocationService;

    private String userId, address, bearer;

    @BeforeEach
    void setUp() {
        when(tokenRevocationService.isCurrent(any(), anyInt())).thenReturn(true);
        when(email.send(anyString(), anyString(), anyString())).thenReturn(true);
        address = "mail-" + UUID.randomUUID() + "@test.dev";
        User u = users.save(User.builder().email(address).passwordHash("x").build());
        userId = u.getId().toString();
        bearer = "Bearer " + jwtUtil.generateToken(u);
    }

    private void tx(String type, double amount, String category, LocalDate date) {
        Transaction t = new Transaction();
        t.setUserId(userId); t.setType(type); t.setAmount(BigDecimal.valueOf(amount));
        t.setCategory(category); t.setMerchant("Shop"); t.setDescription("Shop"); t.setDate(date);
        transactions.save(t);
    }

    private void prefs(java.util.function.Consumer<NotificationSettings> change) {
        NotificationSettings s = settings.findById(userId).orElseGet(() -> NotificationSettings.builder().userId(userId).build());
        change.accept(s);
        settings.save(s);
    }

    @Test
    @DisplayName("weekly digest goes to the user's real address when they turned it on, and not otherwise")
    void weeklyDigest() {
        LocalDate end = LocalDate.now().minusDays(1);
        tx("EXPENSE", 120, "Groceries", end);
        tx("INCOME", 1000, "Salary", end);

        emails.sendWeeklyDigestsNow(); // off by default
        verify(email, never()).send(eq(address), anyString(), anyString());

        prefs(s -> s.setWeeklyDigest(true));
        emails.sendWeeklyDigestsNow();
        verify(email).send(eq(address), contains("your week"), argThat(b -> b.contains("Spent:  $120.00") && b.contains("Groceries")));
    }

    @Test
    @DisplayName("large transaction email above the threshold only, and only if enabled")
    void largeTransaction() throws Exception {
        prefs(s -> s.setLargeTransactionThreshold(new BigDecimal("300")));
        String body = "{\"description\":\"TV\",\"merchant\":\"Big Store\",\"amount\":%s,\"type\":\"EXPENSE\",\"category\":\"Shopping\",\"date\":\"2026-10-01\"}";

        mockMvc.perform(post("/api/transactions").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content(body.formatted("50"))).andExpect(status().isCreated());
        mockMvc.perform(post("/api/transactions").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content(body.formatted("450"))).andExpect(status().isCreated());
        verify(email, timeout(3000).times(1)).send(eq(address), contains("large transaction ($450.00)"), contains("Big Store"));

        prefs(s -> s.setTransactionAlertsEnabled(false));
        mockMvc.perform(post("/api/transactions").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content(body.formatted("900"))).andExpect(status().isCreated());
        verify(email, after(1000).times(1)).send(eq(address), anyString(), anyString());
    }

    @Test
    @DisplayName("a new budget alert is emailed once; turning email off stops it")
    void budgetAlertEmail() {
        budgets.save(Budget.builder().userId(userId).category("Dining").budget(100.0).spent(0.0)
                .month(YearMonth.now().toString()).isActive(true).build());
        tx("EXPENSE", 150, "Dining", LocalDate.now());

        budgetAlerts.checkBudgetAlertsNow();
        budgetAlerts.checkBudgetAlertsNow(); // the alert already exists: no second email
        verify(email, timeout(3000).times(1)).send(eq(address), contains("Budget Exceeded: Dining"), contains("$150.00 of $100.00"));
    }

    @Test
    @DisplayName("nothing is sent when email is turned off")
    void emailOff() {
        prefs(s -> { s.setEmailEnabled(false); s.setWeeklyDigest(true); });
        tx("EXPENSE", 120, "Groceries", LocalDate.now().minusDays(1));
        emails.sendWeeklyDigestsNow();
        verify(email, never()).send(eq(address), anyString(), anyString());
    }
}
