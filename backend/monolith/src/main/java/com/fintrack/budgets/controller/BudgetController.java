package com.fintrack.budgets.controller;

import com.fintrack.budgets.entity.Budget;
import com.fintrack.budgets.service.BudgetsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/budgets")
@RequiredArgsConstructor
@Slf4j
public class BudgetController {

    private final BudgetsService budgetsService;

    @GetMapping
    public ResponseEntity<List<Budget>> getAllBudgets(
            @RequestParam(required = false) String month,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        log.info("GET /api/budgets - userId: {}, month: {}", userId, month);

        if (userId == null || userId.trim().isEmpty()) {
            log.warn("Missing X-User-Id header");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            List<Budget> budgets = budgetsService.getAllBudgetsByUserId(userId, month);
            log.info("Found {} budgets for user {}", budgets.size(), userId);
            return ResponseEntity.ok(budgets);
        } catch (Exception e) {
            log.error("Error fetching budgets for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getBudgetSummary(
            @RequestParam(required = false) String month,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        log.info("GET /api/budgets/summary - userId: {}, month: {}", userId, month);

        if (userId == null || userId.trim().isEmpty()) {
            log.warn("Missing X-User-Id header");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            Map<String, Object> summary = budgetsService.getBudgetSummary(userId, month);
            return ResponseEntity.ok(summary);
        } catch (Exception e) {
            log.error("Error fetching budget summary for user {}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/category")
    public ResponseEntity<Map<String, Object>> getBudgetByCategory(
            @RequestParam String userId,
            @RequestParam String category) {

        log.info("GET /api/budgets/category - userId: {}, category: {}", userId, category);

        if (userId == null || userId.trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }

        try {
            Optional<Budget> budget = budgetsService.getBudgetByCategory(userId, category);

            if (budget.isPresent()) {
                Map<String, Object> result = new HashMap<>();
                result.put("amount", budget.get().getBudget());
                result.put("category", budget.get().getCategory());
                return ResponseEntity.ok(result);
            }

            log.debug("No budget found for userId={} category={}", userId, category);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error fetching budget by category: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Budget> getBudgetById(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        log.info("GET /api/budgets/{} - userId: {}", id, userId);

        if (userId == null || userId.trim().isEmpty()) {
            log.warn("Missing X-User-Id header");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            Budget budget = budgetsService.getBudgetById(String.valueOf(id), userId);
            return ResponseEntity.ok(budget);
        } catch (Exception e) {
            log.error("Error fetching budget {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    @PostMapping
    public ResponseEntity<Budget> createBudget(
            @Valid @RequestBody Budget budget,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        log.info("POST /api/budgets - userId: {}, budget: {}", userId, budget);

        if (userId == null || userId.trim().isEmpty()) {
            log.warn("Missing X-User-Id header");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            // Set userId from header
            budget.setUserId(userId);

            // Ensure month is set - default to current month if not provided
            if (budget.getMonth() == null || budget.getMonth().trim().isEmpty()) {
                String currentMonth = YearMonth.now().toString(); // Format: YYYY-MM
                budget.setMonth(currentMonth);
                log.info("Month not provided, defaulting to: {}", currentMonth);
            }

            // Ensure period is set - default to "monthly" if not provided
            if (budget.getPeriod() == null || budget.getPeriod().trim().isEmpty()) {
                budget.setPeriod("monthly");
                log.info("Period not provided, defaulting to: monthly");
            }

            Budget createdBudget = budgetsService.createBudget(budget);
            log.info("Budget created successfully: {}", createdBudget.getId());
            return ResponseEntity.status(HttpStatus.CREATED).body(createdBudget);
        } catch (Exception e) {
            log.error("Error creating budget: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Budget> updateBudget(
            @PathVariable Long id,
            @Valid @RequestBody Budget budget,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        log.info("PUT /api/budgets/{} - userId: {}", id, userId);

        if (userId == null || userId.trim().isEmpty()) {
            log.warn("Missing X-User-Id header");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            // Ensure userId is set from header
            budget.setUserId(userId);

            // Ensure month is set if not provided
            if (budget.getMonth() == null || budget.getMonth().trim().isEmpty()) {
                String currentMonth = YearMonth.now().toString();
                budget.setMonth(currentMonth);
                log.info("Month not provided in update, defaulting to: {}", currentMonth);
            }

            // Ensure period is set if not provided
            if (budget.getPeriod() == null || budget.getPeriod().trim().isEmpty()) {
                budget.setPeriod("monthly");
                log.info("Period not provided in update, defaulting to: monthly");
            }

            Budget updatedBudget = budgetsService.updateBudget(String.valueOf(id), budget, userId);
            log.info("Budget {} updated successfully", id);
            return ResponseEntity.ok(updatedBudget);
        } catch (Exception e) {
            log.error("Error updating budget {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PatchMapping("/{id}/spent")
    public ResponseEntity<Budget> updateSpent(
            @PathVariable Long id,
            @RequestBody Map<String, Double> payload,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        log.info("PATCH /api/budgets/{}/spent - userId: {}", id, userId);

        if (userId == null || userId.trim().isEmpty()) {
            log.warn("Missing X-User-Id header");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Double spent = payload.get("spent");
        if (spent == null) {
            log.warn("Missing 'spent' field in request body");
            return ResponseEntity.badRequest().build();
        }

        try {
            Budget updatedBudget = budgetsService.updateSpent(String.valueOf(id), spent, userId);
            log.info("Budget {} spent updated to {}", id, spent);
            return ResponseEntity.ok(updatedBudget);
        } catch (Exception e) {
            log.error("Error updating spent for budget {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteBudget(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        log.info("DELETE /api/budgets/{} - userId: {}", id, userId);

        if (userId == null || userId.trim().isEmpty()) {
            log.warn("Missing X-User-Id header");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            budgetsService.deleteBudget(String.valueOf(id), userId);
            log.info("Budget {} deleted successfully", id);
            return ResponseEntity.ok(Map.of("message", "Budget deleted successfully"));
        } catch (Exception e) {
            log.error("Error deleting budget {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
