package com.fintrack.notifications.service;

import com.fintrack.auth.entity.User;
import com.fintrack.auth.repository.UserRepository;
import com.fintrack.auth.service.DemoService;
import com.fintrack.budgets.entity.Budget;
import com.fintrack.budgets.repository.BudgetRepository;
import com.fintrack.common.EmailService;
import com.fintrack.config.AsyncConfig;
import com.fintrack.notifications.entity.NotificationSettings;
import com.fintrack.notifications.repository.NotificationSettingsRepository;
import com.fintrack.transactions.entity.Transaction;
import com.fintrack.transactions.repository.TransactionRepository;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.*;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
 * The emails FinTrack sends: budget alerts, large-transaction alerts, the weekly
 * summary and the monthly report. Each goes only to users who have email turned on
 * and that kind of email enabled in Settings → Notifications, never to the shared
 * demo account. Amounts are shown without a currency symbol: the currency setting
 * lives in the browser.
 */
@Service
@Slf4j
public class NotificationEmailService {

    private final EmailService email;
    private final UserRepository users;
    private final NotificationSettingsRepository settings;
    private final TransactionRepository transactions;
    private final BudgetRepository budgets;
    private final String appUrl;

    public NotificationEmailService(EmailService email, UserRepository users,
                                    NotificationSettingsRepository settings,
                                    TransactionRepository transactions, BudgetRepository budgets,
                                    @Value("${app.base-url:https://fintrack-liart.vercel.app}") String appUrl) {
        this.email = email;
        this.users = users;
        this.settings = settings;
        this.transactions = transactions;
        this.budgets = budgets;
        this.appUrl = appUrl.replaceAll("/+$", "");
    }

    // ── Event emails ─────────────────────────────────────────────────────────

    @Async(AsyncConfig.MAIL_EXECUTOR)
    public void budgetAlert(String userId, String title, String message) {
        send(userId, NotificationSettings::isBudgetAlertsEnabled, "FinTrack: " + title,
                message + "\n\nSee your budgets: " + appUrl + "/goals-budgets?tab=budgets");
    }

    /** A single expense at or above the user's large-transaction threshold. */
    @Async(AsyncConfig.MAIL_EXECUTOR)
    public void largeTransaction(String userId, String merchant, BigDecimal amount, String category) {
        if (amount == null) return;
        send(userId, s -> s.isTransactionAlertsEnabled()
                        && amount.abs().compareTo(s.getLargeTransactionThreshold()) >= 0,
                "FinTrack: large transaction (" + money(amount) + ")",
                "A transaction of " + money(amount) + " at " + (merchant == null ? "an unknown merchant" : merchant)
                        + (category == null ? "" : " (" + category + ")") + " was just recorded.\n\n"
                        + "If this wasn't you, check your account. Review it: " + appUrl + "/transactions");
    }

    // ── Scheduled summaries ──────────────────────────────────────────────────

    /** Mondays 13:07 UTC: the past 7 days compared with the 7 before. */
    @Scheduled(cron = "0 7 13 * * MON", zone = "UTC")
    @SchedulerLock(name = "weeklyDigest", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void sendWeeklyDigests() {
        sendWeeklyDigestsNow();
    }

    /** The work of the weekly job, without its lock. Returns how many were sent. */
    public int sendWeeklyDigestsNow() {
        LocalDate end = LocalDate.now().minusDays(1), start = end.minusDays(6);
        int sent = 0;
        for (NotificationSettings s : settings.findByWeeklyDigestTrueAndEmailEnabledTrue()) {
            try { if (weeklyDigest(s.getUserId(), start, end)) sent++; }
            catch (Exception e) { log.warn("Weekly digest for {} failed: {}", s.getUserId(), e.getMessage()); }
        }
        log.info("Weekly digests sent: {}", sent);
        return sent;
    }

    /** 1st of the month 13:37 UTC: last month's report. */
    @Scheduled(cron = "0 37 13 1 * *", zone = "UTC")
    @SchedulerLock(name = "monthlyReport", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void sendMonthlyReports() {
        sendMonthlyReportsNow();
    }

    /** The work of the monthly job, without its lock. Returns how many were sent. */
    public int sendMonthlyReportsNow() {
        YearMonth month = YearMonth.now().minusMonths(1);
        int sent = 0;
        for (NotificationSettings s : settings.findByMonthlyReportTrueAndEmailEnabledTrue()) {
            try { if (monthlyReport(s.getUserId(), month)) sent++; }
            catch (Exception e) { log.warn("Monthly report for {} failed: {}", s.getUserId(), e.getMessage()); }
        }
        log.info("Monthly reports sent: {}", sent);
        return sent;
    }

    boolean weeklyDigest(String userId, LocalDate start, LocalDate end) {
        List<Transaction> week = transactions.findByUserIdAndDateBetween(userId, start, end);
        if (week.isEmpty()) return false; // nothing to say
        List<Transaction> before = transactions.findByUserIdAndDateBetween(userId, start.minusDays(7), start.minusDays(1));
        BigDecimal spent = total(week, "EXPENSE"), income = total(week, "INCOME"), spentBefore = total(before, "EXPENSE");

        StringBuilder b = new StringBuilder("Your week (" + start + " to " + end + "):\n\n");
        b.append("Spent:  ").append(money(spent));
        if (spentBefore.signum() > 0) {
            BigDecimal change = spent.subtract(spentBefore).multiply(BigDecimal.valueOf(100)).divide(spentBefore, 0, RoundingMode.HALF_UP);
            b.append("  (").append(change.signum() >= 0 ? "+" : "").append(change).append("% vs the week before)");
        }
        b.append("\nIncome: ").append(money(income)).append("\n\n");
        appendTopCategories(b, week);
        b.append("\nSee details: ").append(appUrl).append("/dashboard");
        return send(userId, NotificationSettings::isWeeklyDigest, "FinTrack: your week in numbers", b.toString());
    }

    boolean monthlyReport(String userId, YearMonth month) {
        List<Transaction> txns = transactions.findByUserIdAndDateBetween(userId, month.atDay(1), month.atEndOfMonth());
        if (txns.isEmpty()) return false;
        BigDecimal spent = total(txns, "EXPENSE"), income = total(txns, "INCOME");
        String name = month.getMonth().getDisplayName(TextStyle.FULL, Locale.ENGLISH) + " " + month.getYear();

        StringBuilder b = new StringBuilder("Your report for " + name + ":\n\n");
        b.append("Income:   ").append(money(income)).append("\n");
        b.append("Spent:    ").append(money(spent)).append("\n");
        b.append("Saved:    ").append(money(income.subtract(spent)));
        if (income.signum() > 0) {
            b.append(" (").append(income.subtract(spent).multiply(BigDecimal.valueOf(100)).divide(income, 0, RoundingMode.HALF_UP)).append("% of income)");
        }
        b.append("\n\n");
        appendTopCategories(b, txns);

        List<String> over = new ArrayList<>();
        for (Budget bu : budgets.findByUserIdAndMonth(userId, month.toString())) {
            if (bu.getBudget() == null || bu.getBudget() <= 0 || bu.getCategory() == null) continue;
            BigDecimal catSpent = txns.stream().filter(t -> isType(t, "EXPENSE") && bu.getCategory().equalsIgnoreCase(t.getCategory()))
                    .map(t -> t.getAmount().abs()).reduce(BigDecimal.ZERO, BigDecimal::add);
            if (catSpent.compareTo(BigDecimal.valueOf(bu.getBudget())) > 0) {
                over.add("  " + bu.getCategory() + ": " + money(catSpent) + " of " + money(BigDecimal.valueOf(bu.getBudget())));
            }
        }
        if (!over.isEmpty()) b.append("\nOver budget:\n").append(String.join("\n", over)).append("\n");
        b.append("\nFull report: ").append(appUrl).append("/reports");
        return send(userId, NotificationSettings::isMonthlyReport, "FinTrack: your " + name + " report", b.toString());
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /** Sends if the user has email and this kind of email enabled. True when sent. */
    private boolean send(String userId, Predicate<NotificationSettings> wanted, String subject, String body) {
        if (userId == null) return false;
        NotificationSettings s = settings.findById(userId)
                .orElseGet(() -> NotificationSettings.builder().userId(userId).build()); // defaults
        if (!s.isEmailEnabled() || !wanted.test(s)) return false;
        Optional<User> user;
        try { user = users.findById(UUID.fromString(userId)); } catch (IllegalArgumentException e) { return false; }
        if (user.isEmpty() || user.get().getEmail() == null
                || DemoService.DEMO_EMAIL.equalsIgnoreCase(user.get().getEmail())) return false;
        return email.send(user.get().getEmail(), subject, body
                + "\n\n—\nYou can change which emails you get in Settings → Notifications: " + appUrl + "/settings?tab=notifications");
    }

    private static void appendTopCategories(StringBuilder b, List<Transaction> txns) {
        Map<String, BigDecimal> byCat = txns.stream().filter(t -> isType(t, "EXPENSE"))
                .collect(Collectors.groupingBy(t -> t.getCategory() == null ? "Other" : t.getCategory(),
                        Collectors.reducing(BigDecimal.ZERO, t -> t.getAmount().abs(), BigDecimal::add)));
        if (byCat.isEmpty()) return;
        b.append("Top spending:\n");
        byCat.entrySet().stream().sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed()).limit(3)
                .forEach(e -> b.append("  ").append(e.getKey()).append(": ").append(money(e.getValue())).append("\n"));
    }

    private static BigDecimal total(List<Transaction> txns, String type) {
        return txns.stream().filter(t -> isType(t, type)).map(t -> t.getAmount().abs()).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static boolean isType(Transaction t, String type) {
        return t.getAmount() != null && type.equalsIgnoreCase(t.getType());
    }

    static String money(BigDecimal v) {
        return new DecimalFormat("#,##0.00").format(v.abs().setScale(2, RoundingMode.HALF_UP));
    }
}
