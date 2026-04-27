package com.fintrack.auth.service;

import com.fintrack.auth.dto.AuthResponse;
import com.fintrack.auth.entity.User;
import com.fintrack.auth.enums.Role;
import com.fintrack.auth.repository.UserRepository;
import com.fintrack.auth.security.JwtUtil;
import com.fintrack.budgets.entity.Budget;
import com.fintrack.budgets.entity.Goal;
import com.fintrack.budgets.repository.BudgetRepository;
import com.fintrack.budgets.repository.GoalRepository;
import com.fintrack.transactions.entity.Transaction;
import com.fintrack.transactions.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DemoService {

    private static final String DEMO_EMAIL    = "demo@fintrack.app";
    private static final String DEMO_NAME     = "Demo User";
    private static final String DEMO_USERNAME = "demo";

    private final UserRepository        userRepository;
    private final TransactionRepository transactionRepository;
    private final BudgetRepository      budgetRepository;
    private final GoalRepository        goalRepository;
    private final PasswordEncoder       passwordEncoder;
    private final JwtUtil               jwtUtil;

    @Transactional
    public AuthResponse loginAsDemo() {
        User demo = userRepository.findByEmail(DEMO_EMAIL)
                .orElseGet(this::createDemoUser);

        String userId = demo.getId().toString();

        // Always wipe and re-seed so every demo session starts fresh.
        // Uses direct SQL DELETE (not JPA deleteAll) so the flush happens
        // immediately — prevents old rows surviving into the re-seed.
        wipeUserData(userId);
        seedTransactions(userId);
        seedBudgets(userId);
        seedGoals(userId);
        log.info("✅ Demo data re-seeded for user {}", userId);

        String token = jwtUtil.generateToken(demo);

        AuthResponse.UserDto dto = AuthResponse.UserDto.builder()
                .id(demo.getId())
                .email(demo.getEmail())
                .username(demo.getUsername())
                .firstName(demo.getFirstName())
                .lastName(demo.getLastName())
                .role(demo.getRole().toString())
                .build();

        return AuthResponse.builder().token(token).user(dto).build();
    }

    /**
     * Reset any user's data to the standard demo dataset.
     * Called from POST /api/users/reset-data (authenticated endpoint).
     */
    @Transactional
    public void resetDataForUser(String userId) {
        wipeUserData(userId);
        seedTransactions(userId);
        seedBudgets(userId);
        seedGoals(userId);
        log.info("✅ Data reset to demo dataset for user {}", userId);
    }

    /**
     * Hard-delete all rows for a user using direct SQL — not JPA deleteAll.
     * This ensures the DELETE is flushed immediately before re-seeding starts,
     * preventing stale rows from mixing with new seed data.
     */
    @Transactional
    private void wipeUserData(String userId) {
        transactionRepository.deleteAllByUserId(userId);
        budgetRepository.deleteAllByUserId(userId);
        goalRepository.deleteAllByUserId(userId);
        log.info("🗑️ Wiped all data for user {}", userId);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private User createDemoUser() {
        User u = User.builder()
                .email(DEMO_EMAIL)
                .username(DEMO_USERNAME)
                .firstName("Demo")
                .lastName("User")
                .name(DEMO_NAME)
                .passwordHash(passwordEncoder.encode("demo1234"))
                .role(Role.USER)
                .build();
        return userRepository.save(u);
    }

    private void seedTransactions(String userId) {
        List<Transaction> txns = new ArrayList<>();
        LocalDate today = LocalDate.now();

        // Generate 5 months of history + current month partial
        for (int monthOffset = 5; monthOffset >= 0; monthOffset--) {
            LocalDate base = today.minusMonths(monthOffset).withDayOfMonth(1);
            boolean isCurrent = monthOffset == 0;
            int lastDay = isCurrent ? today.getDayOfMonth() : base.lengthOfMonth();

            // ── Income ─────────────────────────────────────────────────────
            txns.add(tx(userId, "Monthly Salary", 5500, "INCOME", "Employer", "Salary", base.withDayOfMonth(1)));

            // ── Fixed expenses ──────────────────────────────────────────────
            if (lastDay >= 1)  txns.add(tx(userId, "Rent Payment",        1500, "EXPENSE", "Property Mgmt",  "Housing",          base.withDayOfMonth(1)));
            if (lastDay >= 5)  txns.add(tx(userId, "Grocery Shopping",     145, "EXPENSE", "Whole Foods",     "Food & Dining",    base.withDayOfMonth(5)));
            if (lastDay >= 8)  txns.add(tx(userId, "Internet Bill",          80, "EXPENSE", "Comcast",         "Bills & Utilities",base.withDayOfMonth(8)));
            if (lastDay >= 10) txns.add(tx(userId, "Electricity Bill",      130, "EXPENSE", "Duke Energy",     "Bills & Utilities",base.withDayOfMonth(10)));
            if (lastDay >= 12) txns.add(tx(userId, "Dinner with Friends",    65, "EXPENSE", "The Cheesecake Factory","Food & Dining",base.withDayOfMonth(12)));
            if (lastDay >= 14) txns.add(tx(userId, "Netflix Subscription",   15, "EXPENSE", "Netflix",         "Entertainment",    base.withDayOfMonth(14)));
            if (lastDay >= 14) txns.add(tx(userId, "Spotify Premium",        10, "EXPENSE", "Spotify",         "Entertainment",    base.withDayOfMonth(14)));
            if (lastDay >= 15) txns.add(tx(userId, "Gas Station",            58, "EXPENSE", "Shell",           "Transportation",   base.withDayOfMonth(15)));
            if (lastDay >= 18) txns.add(tx(userId, "Grocery Shopping",      138, "EXPENSE", "Trader Joe's",    "Food & Dining",    base.withDayOfMonth(18)));
            if (lastDay >= 20) txns.add(tx(userId, "Coffee Shop",            22, "EXPENSE", "Starbucks",       "Food & Dining",    base.withDayOfMonth(20)));
            if (lastDay >= 22) txns.add(tx(userId, "Gym Membership",         45, "EXPENSE", "Planet Fitness",  "Health & Fitness", base.withDayOfMonth(22)));
            if (lastDay >= 25) txns.add(tx(userId, "Phone Bill",             85, "EXPENSE", "Verizon",         "Bills & Utilities",base.withDayOfMonth(25)));
            if (lastDay >= 28) txns.add(tx(userId, "Amazon Purchase",       112, "EXPENSE", "Amazon",          "Shopping",         base.withDayOfMonth(Math.min(28, lastDay))));

            // ── Variable / month-specific ──────────────────────────────────
            if (!isCurrent) {
                // Add some variety across months
                if (monthOffset % 2 == 0 && lastDay >= 16) {
                    txns.add(tx(userId, "Weekend Getaway",   280, "EXPENSE", "Airbnb",       "Travel",       base.withDayOfMonth(16)));
                }
                if (monthOffset % 3 == 0 && lastDay >= 9) {
                    txns.add(tx(userId, "Online Course",     199, "EXPENSE", "Udemy",        "Education",    base.withDayOfMonth(9)));
                }
                if (lastDay >= 23) {
                    txns.add(tx(userId, "Restaurant Lunch",   38, "EXPENSE", "Chipotle",     "Food & Dining",base.withDayOfMonth(23)));
                }
            }

            // ── Anomaly: unusually high restaurant bill in month -1 ────────
            if (monthOffset == 1 && lastDay >= 20) {
                txns.add(tx(userId, "Valentine's Dinner",  320, "EXPENSE", "Gordon Ramsay Hell's Kitchen", "Food & Dining", base.withDayOfMonth(20)));
            }

            // ── Freelance bonus in month -2 ────────────────────────────────
            if (monthOffset == 2) {
                txns.add(tx(userId, "Freelance Payment",  1200, "INCOME", "Client Project", "Freelance", base.withDayOfMonth(17)));
            }
        }

        transactionRepository.saveAll(txns);
    }

    private void seedBudgets(String userId) {
        String month = LocalDate.now().getYear() + "-" +
                String.format("%02d", LocalDate.now().getMonthValue());

        List<Budget> budgets = List.of(
                Budget.builder().userId(userId).category("Food & Dining")    .budget(600.0).spent(0.0).month(month).icon("🍽️").color("#f97316").period("monthly").isActive(true).build(),
                Budget.builder().userId(userId).category("Housing")          .budget(1600.0).spent(0.0).month(month).icon("🏠").color("#6366f1").period("monthly").isActive(true).build(),
                Budget.builder().userId(userId).category("Bills & Utilities").budget(320.0).spent(0.0).month(month).icon("💡").color("#0ea5e9").period("monthly").isActive(true).build(),
                Budget.builder().userId(userId).category("Entertainment")    .budget(150.0).spent(0.0).month(month).icon("🎬").color("#8b5cf6").period("monthly").isActive(true).build(),
                Budget.builder().userId(userId).category("Transportation")   .budget(200.0).spent(0.0).month(month).icon("🚗").color("#10b981").period("monthly").isActive(true).build(),
                Budget.builder().userId(userId).category("Shopping")         .budget(300.0).spent(0.0).month(month).icon("🛍️").color("#f59e0b").period("monthly").isActive(true).build(),
                Budget.builder().userId(userId).category("Health & Fitness") .budget(100.0).spent(0.0).month(month).icon("💪").color("#ec4899").period("monthly").isActive(true).build()
        );
        budgetRepository.saveAll(budgets);
    }

    private void seedGoals(String userId) {
        LocalDate today = LocalDate.now();
        List<Goal> goals = List.of(
                Goal.builder()
                        .userId(userId).name("Emergency Fund")
                        .targetAmount(new BigDecimal("10000.00"))
                        .currentAmount(new BigDecimal("4200.00"))
                        .deadline(today.plusMonths(8))
                        .category("Savings").icon("🛡️").color("#10b981")
                        .monthlyContribution(new BigDecimal("700.00")).achieved(false).build(),
                Goal.builder()
                        .userId(userId).name("Vacation to Japan")
                        .targetAmount(new BigDecimal("3500.00"))
                        .currentAmount(new BigDecimal("1750.00"))
                        .deadline(today.plusMonths(5))
                        .category("Travel").icon("✈️").color("#6366f1")
                        .monthlyContribution(new BigDecimal("350.00")).achieved(false).build(),
                Goal.builder()
                        .userId(userId).name("New Laptop")
                        .targetAmount(new BigDecimal("1800.00"))
                        .currentAmount(new BigDecimal("1620.00"))
                        .deadline(today.plusMonths(1))
                        .category("Tech").icon("💻").color("#f59e0b")
                        .monthlyContribution(new BigDecimal("200.00")).achieved(false).build(),
                Goal.builder()
                        .userId(userId).name("Down Payment")
                        .targetAmount(new BigDecimal("50000.00"))
                        .currentAmount(new BigDecimal("8500.00"))
                        .deadline(today.plusMonths(36))
                        .category("Housing").icon("🏠").color("#3b82f6")
                        .monthlyContribution(new BigDecimal("1150.00")).achieved(false).build()
        );
        goalRepository.saveAll(goals);
    }

    private Transaction tx(String userId, String desc, double amount,
                           String type, String merchant, String category, LocalDate date) {
        Transaction t = new Transaction();
        t.setUserId(userId);
        t.setDescription(desc);
        t.setAmount(BigDecimal.valueOf(amount));
        t.setType(type);
        t.setMerchant(merchant);
        t.setCategory(category);
        t.setDate(date);
        t.setStatus("completed");
        return t;
    }
}
