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

    @Test
    @DisplayName("unusual spending: far above the category's usual amount is flagged; normal amounts and switched-off users aren't")
    void unusualSpending() throws Exception {
        LocalDate d = LocalDate.now().minusDays(3);
        tx("EXPENSE", 38, "Dining", d);
        tx("EXPENSE", 42, "Dining", d);
        tx("EXPENSE", 40, "Dining", d);
        String body = "{\"description\":\"Dinner\",\"merchant\":\"Bistro\",\"amount\":%s,\"type\":\"EXPENSE\",\"category\":\"Dining\",\"date\":\"" + LocalDate.now() + "\"}";

        mockMvc.perform(post("/api/transactions").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content(body.formatted("55"))).andExpect(status().isCreated());   // a bit more than usual: fine
        mockMvc.perform(post("/api/transactions").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content(body.formatted("160"))).andExpect(status().isCreated());  // ~3.6x the usual
        verify(email, timeout(3000).times(1)).send(eq(address), contains("unusual spending in Dining"),
                argThat(b -> b.contains("$160.00 at Bistro") && b.contains("your usual")));

        // The large-transaction alert covers big ones: only one message, not two
        prefs(s -> s.setLargeTransactionThreshold(new BigDecimal("200")));
        mockMvc.perform(post("/api/transactions").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content(body.formatted("400"))).andExpect(status().isCreated());
        verify(email, timeout(3000).times(1)).send(eq(address), contains("large transaction"), anyString());
        verify(email, after(1000).times(1)).send(eq(address), contains("unusual spending"), anyString());

        prefs(s -> { s.setUnusualSpending(false); s.setLargeTransactionThreshold(new BigDecimal("100000")); });
        mockMvc.perform(post("/api/transactions").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content(body.formatted("170"))).andExpect(status().isCreated());
        verify(email, after(1000).times(1)).send(eq(address), contains("unusual spending"), anyString());
    }

    @Test
    @DisplayName("goal milestones: each sent once, a jump sends only the highest, and the switch turns them off")
    void goalMilestones() throws Exception {
        String goal = "{\"name\":\"Trip\",\"category\":\"Travel\",\"target\":1000,\"current\":300,\"deadline\":\"2027-06-01\"}";
        var created = mockMvc.perform(post("/api/goals").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content(goal)).andExpect(status().is2xxSuccessful()).andReturn();
        String id = com.jayway.jsonpath.JsonPath.read(created.getResponse().getContentAsString(), "$.id").toString();
        String contribute = "/api/goals/" + id + "/contribute";

        // Created at 30 %: no "25 %" message for money that was already there
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(contribute)
                .header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON).content("{\"amount\":100}")).andExpect(status().isOk()); // 40 %
        verify(email, after(800).never()).send(eq(address), contains("Trip"), anyString());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(contribute)
                .header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON).content("{\"amount\":400}")).andExpect(status().isOk()); // 80 %: past 50 and 75
        verify(email, timeout(3000).times(1)).send(eq(address), contains("Trip: 75% saved"), contains("$800.00 of $1,000.00"));
        verify(email, never()).send(eq(address), contains("Trip: 50%"), anyString());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(contribute)
                .header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON).content("{\"amount\":10}")).andExpect(status().isOk()); // still 75
        verify(email, after(800).times(1)).send(eq(address), contains("Trip"), anyString());

        prefs(s -> s.setGoalMilestones(false));
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(contribute)
                .header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON).content("{\"amount\":500}")).andExpect(status().isOk()); // 100 %
        verify(email, after(1000).times(1)).send(eq(address), contains("Trip"), anyString());
    }
}
