package com.fintrack.reports.controller;

import com.fintrack.reports.service.PdfGeneratorService;
import com.fintrack.reports.service.ReportsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
@Slf4j
public class ReportsController {

    private final ReportsService reportsService;
    private final PdfGeneratorService pdfGeneratorService;

    @GetMapping("/financial")
    public ResponseEntity<Map<String, Object>> getFinancialReports(
            @RequestParam(defaultValue = "last-30-days") String range,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            Authentication authentication) {

        String finalUserId = resolveUserId(userId, authentication);
        if (finalUserId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Map<String, Object> reports = reportsService.getFinancialReports(finalUserId, range);
        return ResponseEntity.ok(reports);
    }

    @GetMapping("/monthly-summary")
    public ResponseEntity<List<Map<String, Object>>> getMonthlySummary(
            @RequestParam(defaultValue = "last-6-months") String range,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            Authentication authentication) {

        String finalUserId = resolveUserId(userId, authentication);
        if (finalUserId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        List<Map<String, Object>> summary = reportsService.getMonthlySummary(finalUserId, range);
        return ResponseEntity.ok(summary);
    }

    @GetMapping("/category-breakdown")
    public ResponseEntity<List<Map<String, Object>>> getCategoryBreakdown(
            @RequestParam(defaultValue = "last-30-days") String range,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            Authentication authentication) {

        String finalUserId = resolveUserId(userId, authentication);
        if (finalUserId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        java.time.LocalDate[] dateRange = parseDateRange(range);
        List<Map<String, Object>> breakdown = reportsService.getCategoryBreakdown(
                finalUserId, dateRange[0], dateRange[1]);
        return ResponseEntity.ok(breakdown);
    }

    @GetMapping("/savings-goals")
    public ResponseEntity<List<Map<String, Object>>> getSavingsGoals(
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            Authentication authentication) {

        String finalUserId = resolveUserId(userId, authentication);
        if (finalUserId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        List<Map<String, Object>> goals = reportsService.getSavingsGoals(finalUserId);
        return ResponseEntity.ok(goals);
    }

    @GetMapping("/top-expenses")
    public ResponseEntity<List<Map<String, Object>>> getTopExpenses(
            @RequestParam(defaultValue = "last-30-days") String range,
            @RequestParam(defaultValue = "5") int limit,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            Authentication authentication) {

        String finalUserId = resolveUserId(userId, authentication);
        if (finalUserId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        java.time.LocalDate[] dateRange = parseDateRange(range);
        List<Map<String, Object>> expenses = reportsService.getTopExpenses(
                finalUserId, dateRange[0], dateRange[1], limit);
        return ResponseEntity.ok(expenses);
    }

    @GetMapping("/insights")
    public ResponseEntity<List<String>> getFinancialInsights(
            @RequestParam(defaultValue = "last-30-days") String range,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            Authentication authentication) {

        String finalUserId = resolveUserId(userId, authentication);
        if (finalUserId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        java.time.LocalDate[] dateRange = parseDateRange(range);
        List<String> insights = reportsService.generateInsights(
                finalUserId, dateRange[0], dateRange[1]);
        return ResponseEntity.ok(insights);
    }

    @GetMapping("/export/pdf")
    public ResponseEntity<byte[]> exportReportPDF(
            @RequestParam(defaultValue = "last-30-days") String range,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            Authentication authentication) {

        String finalUserId = resolveUserId(userId, authentication);
        if (finalUserId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        // Fetch the same report data shown in the Overview tab
        Map<String, Object> reportData = reportsService.getFinancialReports(finalUserId, range);

        // Generate real PDF bytes
        byte[] pdfBytes = pdfGeneratorService.generateFinancialReport(reportData, range);

        // Sanitize range parameter for use in filename
        String safeRange = range.replaceAll("[^a-zA-Z0-9\\-]", "");
        String filename = "financial-report-" + safeRange + ".pdf";

        return ResponseEntity.ok()
                .header("Content-Type", "application/pdf")
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .header("Content-Length", String.valueOf(pdfBytes.length))
                .body(pdfBytes);
    }

    @GetMapping("/comparison")
    public ResponseEntity<Map<String, Object>> getComparisonData(
            @RequestParam(defaultValue = "last-30-days") String period1,
            @RequestParam(defaultValue = "last-30-days") String period2,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            Authentication authentication) {

        String finalUserId = resolveUserId(userId, authentication);
        if (finalUserId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        try {
            java.time.LocalDate[] range1 = parseDateRange(period1);
            java.time.LocalDate[] range2 = parseDateRange(period2);

            Map<String, Object> summary1 = reportsService.getFinancialSummary(
                    finalUserId, range1[0], range1[1], period1);
            Map<String, Object> summary2 = reportsService.getFinancialSummary(
                    finalUserId, range2[0], range2[1], period2);

            return ResponseEntity.ok(Map.of(
                    "period1", Map.of("range", period1, "data", summary1),
                    "period2", Map.of("range", period2, "data", summary2)));
        } catch (Exception e) {
            log.error("Error generating comparison for userId={}: {}", finalUserId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/forecast")
    public ResponseEntity<Map<String, Object>> getForecastData(
            @RequestParam(defaultValue = "3") int months,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            Authentication authentication) {

        String finalUserId = resolveUserId(userId, authentication);
        if (finalUserId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        try {
            // Use last-6-months of history to project forward
            List<Map<String, Object>> history = reportsService.getMonthlySummary(finalUserId, "last-6-months");

            // Calculate average monthly income and expenses from history
            double avgIncome   = history.stream()
                    .mapToDouble(m -> toDouble(m.get("income"))).average().orElse(0);
            double avgExpenses = history.stream()
                    .mapToDouble(m -> toDouble(m.get("expenses"))).average().orElse(0);
            double avgSavings  = avgIncome - avgExpenses;

            // Build projected months
            List<Map<String, Object>> projected = new java.util.ArrayList<>();
            java.time.LocalDate next = java.time.LocalDate.now().withDayOfMonth(1);
            for (int i = 1; i <= Math.max(1, Math.min(months, 12)); i++) {
                next = next.plusMonths(1);
                projected.add(Map.of(
                        "month",    next.toString().substring(0, 7),
                        "income",   Math.round(avgIncome   * 100.0) / 100.0,
                        "expenses", Math.round(avgExpenses * 100.0) / 100.0,
                        "savings",  Math.round(avgSavings  * 100.0) / 100.0));
            }

            return ResponseEntity.ok(Map.of(
                    "forecast",        projected,
                    "basedOnMonths",   history.size(),
                    "averageIncome",   Math.round(avgIncome   * 100.0) / 100.0,
                    "averageExpenses", Math.round(avgExpenses * 100.0) / 100.0,
                    "averageSavings",  Math.round(avgSavings  * 100.0) / 100.0));
        } catch (Exception e) {
            log.error("Error generating forecast for userId={}: {}", finalUserId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /** Safely converts a value from report maps to double. */
    private double toDouble(Object val) {
        if (val == null) return 0;
        if (val instanceof Number) return ((Number) val).doubleValue();
        try { return Double.parseDouble(val.toString()); } catch (NumberFormatException e) { return 0; }
    }

    /**
     * Resolves userId from the X-User-Id header (injected by JwtAuthenticationFilter from JWT)
     * or falls back to the authenticated principal name. Returns null if neither is available,
     * which callers should treat as a 401.
     */
    private String resolveUserId(String headerUserId, Authentication authentication) {
        if (headerUserId != null && !headerUserId.isBlank()) {
            return headerUserId;
        }
        if (authentication != null && authentication.getPrincipal() != null) {
            return authentication.getName();
        }
        log.warn("Could not resolve userId: no X-User-Id header and no authenticated principal");
        return null;
    }

    private java.time.LocalDate[] parseDateRange(String dateRange) {
        java.time.LocalDate endDate = java.time.LocalDate.now();
        java.time.LocalDate startDate;

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

        return new java.time.LocalDate[] { startDate, endDate };
    }
}
