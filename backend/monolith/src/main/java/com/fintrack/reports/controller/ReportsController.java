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
            @RequestParam String period1,
            @RequestParam String period2,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            Authentication authentication) {

        String finalUserId = resolveUserId(userId, authentication);
        if (finalUserId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(Map.of("period1", Map.of(), "period2", Map.of()));
    }

    @GetMapping("/forecast")
    public ResponseEntity<Map<String, Object>> getForecastData(
            @RequestParam(defaultValue = "6") int months,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            Authentication authentication) {

        String finalUserId = resolveUserId(userId, authentication);
        if (finalUserId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(Map.of("forecast", List.of()));
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
