package com.fintrack.reports.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ReportsService {

    private final RestTemplate restTemplate;

    // Transaction service runs on port 8082
    @Value("${services.transactions.url:http://localhost:8082}")
    private String transactionsServiceUrl;

    // Goals/Budgets service runs on port 8085
    @Value("${services.budgets.url:http://localhost:8085}")
    private String budgetsServiceUrl;

    public ReportsService(@Qualifier("reportsRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * Get comprehensive financial reports
     */
    public Map<String, Object> getFinancialReports(String userId, String dateRange) {
        log.info("Generating financial reports for user: {} with range: {}", userId, dateRange);

        LocalDate[] dateRangeArray = parseDateRange(dateRange);
        LocalDate startDate = dateRangeArray[0];
        LocalDate endDate = dateRangeArray[1];

        Map<String, Object> report = new HashMap<>();

        report.put("summary", getFinancialSummary(userId, startDate, endDate, dateRange));
        report.put("monthlyData", getMonthlySummary(userId, dateRange));
        report.put("categoryBreakdown", getCategoryBreakdown(userId, startDate, endDate));
        report.put("savingsGoals", getSavingsGoals(userId));
        report.put("topExpenses", getTopExpenses(userId, startDate, endDate, 5));
        report.put("insights", generateInsights(userId, startDate, endDate));

        log.info("Successfully generated financial reports for user: {}", userId);
        return report;
    }

    /**
     * Get financial summary with changes
     */
    public Map<String, Object> getFinancialSummary(String userId, LocalDate startDate,
            LocalDate endDate, String dateRange) {
        List<Map<String, Object>> currentTransactions = getTransactionsFromService(userId, startDate, endDate);

        LocalDate[] previousRange = getPreviousPeriod(dateRange);
        List<Map<String, Object>> previousTransactions = getTransactionsFromService(userId, previousRange[0],
                previousRange[1]);

        BigDecimal currentIncome = calculateTotalByType(currentTransactions, "INCOME");
        BigDecimal currentExpenses = calculateTotalByType(currentTransactions, "EXPENSE");
        BigDecimal currentSavings = currentIncome.subtract(currentExpenses);

        BigDecimal previousIncome = calculateTotalByType(previousTransactions, "INCOME");
        BigDecimal previousExpenses = calculateTotalByType(previousTransactions, "EXPENSE");
        BigDecimal previousSavings = previousIncome.subtract(previousExpenses);

        Map<String, Object> summary = new HashMap<>();
        summary.put("netIncome", currentIncome);
        summary.put("totalExpenses", currentExpenses);
        summary.put("netSavings", currentSavings);
        summary.put("savingsRate", calculateSavingsRate(currentSavings, currentIncome));
        summary.put("incomeChange", calculatePercentageChange(previousIncome, currentIncome));
        summary.put("expensesChange", calculatePercentageChange(previousExpenses, currentExpenses));
        summary.put("savingsChange", calculatePercentageChange(previousSavings, currentSavings));

        BigDecimal prevSavingsRate = calculateSavingsRate(previousSavings, previousIncome);
        BigDecimal currSavingsRate = calculateSavingsRate(currentSavings, currentIncome);
        summary.put("savingsRateChange", currSavingsRate.subtract(prevSavingsRate));

        return summary;
    }

    /**
     * Get monthly summary for trend charts
     */
    public List<Map<String, Object>> getMonthlySummary(String userId, String dateRange) {
        LocalDate[] range = parseDateRange(dateRange);
        LocalDate startDate = range[0];
        LocalDate endDate = range[1];

        List<Map<String, Object>> transactions = getTransactionsFromService(userId, startDate, endDate);

        if (transactions.isEmpty()) {
            log.info("No transactions found for user {} in date range", userId);
            return new ArrayList<>();
        }

        Map<String, List<Map<String, Object>>> monthlyGroups = transactions.stream()
                .collect(Collectors.groupingBy(t -> {
                    String dateStr = (String) t.get("date");
                    LocalDate date = LocalDate.parse(dateStr);
                    return date.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
                }));

        List<Map<String, Object>> monthlySummary = new ArrayList<>();

        for (Map.Entry<String, List<Map<String, Object>>> entry : monthlyGroups.entrySet()) {
            Map<String, Object> monthData = new HashMap<>();
            monthData.put("month", entry.getKey());

            BigDecimal income = calculateTotalByType(entry.getValue(), "INCOME");
            BigDecimal expenses = calculateTotalByType(entry.getValue(), "EXPENSE");
            BigDecimal savings = income.subtract(expenses);

            monthData.put("income", income);
            monthData.put("expenses", expenses);
            monthData.put("savings", savings);
            monthData.put("target", BigDecimal.valueOf(1500));

            monthlySummary.add(monthData);
        }

        return monthlySummary;
    }

    /**
     * Get spending breakdown by category
     */
    public List<Map<String, Object>> getCategoryBreakdown(String userId, LocalDate startDate,
            LocalDate endDate) {
        List<Map<String, Object>> allTransactions = getTransactionsFromService(userId, startDate, endDate);

        List<Map<String, Object>> expenses = allTransactions.stream()
                .filter(t -> "EXPENSE".equals(t.get("type")))
                .collect(Collectors.toList());

        if (expenses.isEmpty()) {
            log.info("No expenses found for user {} in date range", userId);
            return new ArrayList<>();
        }

        Map<String, List<Map<String, Object>>> categoryGroups = expenses.stream()
                .collect(Collectors.groupingBy(t -> (String) t.get("category")));

        List<Map<String, Object>> breakdown = new ArrayList<>();
        BigDecimal totalExpenses = calculateTotal(expenses);

        String[] colors = { "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#6b7280" };
        int colorIndex = 0;

        for (Map.Entry<String, List<Map<String, Object>>> entry : categoryGroups.entrySet()) {
            Map<String, Object> categoryData = new HashMap<>();
            BigDecimal categoryTotal = calculateTotal(entry.getValue());
            BigDecimal budget = getBudgetForCategory(userId, entry.getKey());

            categoryData.put("name", entry.getKey());
            categoryData.put("amount", categoryTotal);
            categoryData.put("budget", budget);
            categoryData.put("percentage", calculatePercentage(categoryTotal, totalExpenses));
            categoryData.put("color", colors[colorIndex++ % colors.length]);

            breakdown.add(categoryData);
        }

        return breakdown.stream()
                .sorted((a, b) -> ((BigDecimal) b.get("amount")).compareTo((BigDecimal) a.get("amount")))
                .collect(Collectors.toList());
    }

    /**
     * Get savings goals progress
     */
    public List<Map<String, Object>> getSavingsGoals(String userId) {
        try {
            String url = budgetsServiceUrl + "/api/goals?userId=" + userId;

            log.debug("Fetching savings goals from: {}", url);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<?> entity = new HttpEntity<>(headers);

            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {
                    });

            List<Map<String, Object>> goals = response.getBody();
            if (goals == null || goals.isEmpty()) {
                log.info("No savings goals found for user: {}", userId);
                return new ArrayList<>();
            }

            String[] colors = { "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6" };
            List<Map<String, Object>> result = new ArrayList<>();

            for (int i = 0; i < goals.size(); i++) {
                Map<String, Object> goal = goals.get(i);
                Map<String, Object> goalData = new HashMap<>();
                goalData.put("name", goal.get("name"));
                goalData.put("current", goal.get("currentAmount"));
                goalData.put("target", goal.get("targetAmount"));

                BigDecimal current = new BigDecimal(goal.get("currentAmount").toString());
                BigDecimal target = new BigDecimal(goal.get("targetAmount").toString());
                goalData.put("progress", calculateProgress(current, target));
                goalData.put("color", colors[i % colors.length]);
                result.add(goalData);
            }

            return result;
        } catch (Exception e) {
            log.error("Error fetching savings goals for user {}: {}", userId, e.getMessage());
            return new ArrayList<>();
        }
    }

    /**
     * Get top expenses by vendor
     */
    public List<Map<String, Object>> getTopExpenses(String userId, LocalDate startDate,
            LocalDate endDate, int limit) {
        List<Map<String, Object>> allTransactions = getTransactionsFromService(userId, startDate, endDate);

        List<Map<String, Object>> expenses = allTransactions.stream()
                .filter(t -> "EXPENSE".equals(t.get("type")))
                .collect(Collectors.toList());

        if (expenses.isEmpty()) {
            return new ArrayList<>();
        }

        Map<String, List<Map<String, Object>>> vendorGroups = expenses.stream()
                .collect(Collectors.groupingBy(t -> (String) t.get("description")));

        List<Map<String, Object>> topExpenses = new ArrayList<>();

        for (Map.Entry<String, List<Map<String, Object>>> entry : vendorGroups.entrySet()) {
            Map<String, Object> expenseData = new HashMap<>();
            BigDecimal total = calculateTotal(entry.getValue());

            expenseData.put("vendor", entry.getKey());
            expenseData.put("category", entry.getValue().get(0).get("category"));
            expenseData.put("amount", total);
            expenseData.put("frequency", entry.getValue().size());

            topExpenses.add(expenseData);
        }

        return topExpenses.stream()
                .sorted((a, b) -> ((BigDecimal) b.get("amount")).compareTo((BigDecimal) a.get("amount")))
                .limit(limit)
                .collect(Collectors.toList());
    }

    /**
     * Generate financial insights
     */
    public List<String> generateInsights(String userId, LocalDate startDate, LocalDate endDate) {
        List<String> insights = new ArrayList<>();

        List<Map<String, Object>> transactions = getTransactionsFromService(userId, startDate, endDate);

        if (transactions.isEmpty()) {
            insights.add("Start adding transactions to get personalized financial insights.");
            return insights;
        }

        BigDecimal income = calculateTotalByType(transactions, "INCOME");
        BigDecimal expenses = calculateTotalByType(transactions, "EXPENSE");
        BigDecimal savings = income.subtract(expenses);
        BigDecimal savingsRate = calculateSavingsRate(savings, income);

        if (income.compareTo(BigDecimal.ZERO) > 0) {
            if (savingsRate.compareTo(BigDecimal.valueOf(30)) > 0) {
                insights.add("Great job! Your savings rate of " + savingsRate.intValue() + "% is excellent.");
            } else if (savingsRate.compareTo(BigDecimal.valueOf(20)) > 0) {
                insights.add("Your savings rate of " + savingsRate.intValue()
                        + "% is good. Consider increasing it to 30% or more.");
            } else if (savingsRate.compareTo(BigDecimal.ZERO) >= 0) {
                insights.add("Your savings rate of " + savingsRate.intValue()
                        + "% could be improved. Aim for at least 20%.");
            } else {
                insights.add(
                        "You're spending more than you earn. Review your expenses to improve your financial health.");
            }
        }

        List<Map<String, Object>> categories = getCategoryBreakdown(userId, startDate, endDate);
        for (Map<String, Object> category : categories) {
            BigDecimal amount = (BigDecimal) category.get("amount");
            BigDecimal budget = (BigDecimal) category.get("budget");

            if (amount.compareTo(budget) > 0 && insights.size() < 4) {
                BigDecimal overBudget = amount.subtract(budget);
                BigDecimal percentage = overBudget.divide(budget, 2, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100));
                insights.add(category.get("name") + " is " + percentage.intValue() +
                        "% over budget. Consider reducing spending in this category.");
            }
        }

        if (insights.isEmpty()) {
            insights.add("Keep tracking your expenses to get personalized insights.");
        }

        return insights.stream().limit(4).collect(Collectors.toList());
    }

    // ========== REST API Helper Methods ==========

    private List<Map<String, Object>> getTransactionsFromService(String userId, LocalDate startDate,
            LocalDate endDate) {
        try {
            String url = String.format("%s/api/transactions/reports?userId=%s&startDate=%s&endDate=%s",
                    transactionsServiceUrl, userId, startDate.toString(), endDate.toString());

            log.debug("Fetching transactions from: {}", url);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<?> entity = new HttpEntity<>(headers);

            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {
                    });

            List<Map<String, Object>> transactions = response.getBody();
            log.debug("Fetched {} transactions", transactions != null ? transactions.size() : 0);

            return transactions != null ? transactions : new ArrayList<>();
        } catch (Exception e) {
            log.error("Error fetching transactions from service: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    private BigDecimal getBudgetForCategory(String userId, String category) {
        try {
            String url = String.format("%s/api/budgets/category?userId=%s&category=%s",
                    budgetsServiceUrl, userId, category);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<?> entity = new HttpEntity<>(headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    });

            if (response.getBody() != null && response.getBody().get("amount") != null) {
                return new BigDecimal(response.getBody().get("amount").toString());
            }
        } catch (Exception e) {
            log.debug("Budget not found for category {}: {}", category, e.getMessage());
        }
        return BigDecimal.valueOf(1000);
    }

    // ========== Helper Methods ==========

    private LocalDate[] parseDateRange(String dateRange) {
        LocalDate endDate = LocalDate.now();
        LocalDate startDate;

        switch (dateRange) {
            case "last-7-days":
                startDate = endDate.minusDays(7);
                break;
            case "last-30-days":
                startDate = endDate.minusDays(30);
                break;
            case "last-3-months":
                startDate = endDate.minusMonths(3);
                break;
            case "last-6-months":
                startDate = endDate.minusMonths(6);
                break;
            case "last-year":
                startDate = endDate.minusYears(1);
                break;
            default:
                startDate = endDate.minusDays(30);
        }

        return new LocalDate[] { startDate, endDate };
    }

    private LocalDate[] getPreviousPeriod(String dateRange) {
        LocalDate[] current = parseDateRange(dateRange);
        long daysDiff = java.time.temporal.ChronoUnit.DAYS.between(current[0], current[1]);

        LocalDate endDate = current[0];
        LocalDate startDate = endDate.minusDays(daysDiff);

        return new LocalDate[] { startDate, endDate };
    }

    private BigDecimal calculateTotalByType(List<Map<String, Object>> transactions, String type) {
        return transactions.stream()
                .filter(t -> type.equals(t.get("type")))
                .map(t -> new BigDecimal(t.get("amount").toString()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal calculateTotal(List<Map<String, Object>> transactions) {
        return transactions.stream()
                .map(t -> new BigDecimal(t.get("amount").toString()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal calculateSavingsRate(BigDecimal savings, BigDecimal income) {
        if (income.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return savings.divide(income, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));
    }

    private BigDecimal calculatePercentageChange(BigDecimal previous, BigDecimal current) {
        if (previous.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return current.subtract(previous)
                .divide(previous, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));
    }

    private int calculatePercentage(BigDecimal part, BigDecimal total) {
        if (total.compareTo(BigDecimal.ZERO) == 0) {
            return 0;
        }
        return part.divide(total, 2, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .intValue();
    }

    private int calculateProgress(BigDecimal current, BigDecimal target) {
        if (target.compareTo(BigDecimal.ZERO) == 0) {
            return 0;
        }
        return current.divide(target, 2, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .intValue();
    }
}