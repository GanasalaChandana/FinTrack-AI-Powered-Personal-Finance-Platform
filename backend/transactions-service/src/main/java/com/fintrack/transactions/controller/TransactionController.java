package com.fintrack.transactions.controller;

import com.fintrack.transactions.dto.TransactionResponse;
import com.fintrack.transactions.dto.CreateTransactionRequest;
import com.fintrack.transactions.service.TransactionService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003" })
public class TransactionController {

    private final TransactionService transactionService;

    @Value("${app.environment:dev}")
    private String environment;

    @GetMapping
    public ResponseEntity<List<TransactionResponse>> getAllTransactions(
            @RequestParam(required = false) Integer limit,
            @RequestHeader(name = "X-User-Id", required = false) String userId,
            @RequestHeader(name = "Authorization", required = false) String authHeader) {

        String uid = resolveUserId(userId, authHeader);
        log.info("Getting transactions for user: {} (limit: {})", uid, limit);

        List<TransactionResponse> transactions = transactionService.getAllTransactions(uid);

        if (limit != null && limit > 0 && transactions.size() > limit) {
            transactions = transactions.subList(0, limit);
        }

        return ResponseEntity.ok(transactions);
    }

    // ⚠️ IMPORTANT: Specific routes MUST come BEFORE generic path variable routes
    // Move all specific endpoints (classify, summary, health) BEFORE /{id}

    @PostMapping("/classify")
    public ResponseEntity<Map<String, String>> classifyTransaction(
            @RequestBody Map<String, String> request,
            @RequestHeader(name = "X-User-Id", required = false) String userId,
            @RequestHeader(name = "Authorization", required = false) String authHeader) {

        String uid = resolveUserId(userId, authHeader);
        String description = request.get("description");
        log.info("Classifying transaction for user: {}", uid);

        String category = transactionService.classifyTransaction(description);
        return ResponseEntity.ok(Map.of("category", category));
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestHeader(name = "X-User-Id", required = false) String userId,
            @RequestHeader(name = "Authorization", required = false) String authHeader) {

        String uid = resolveUserId(userId, authHeader);
        log.info("Getting transaction summary for user: {}", uid);
        return ResponseEntity.ok(transactionService.getSummary(uid, startDate, endDate));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        log.debug("Health check called");
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "transactions-service",
                "environment", environment));
    }

    // NOW the generic /{id} route comes AFTER all specific routes
    @GetMapping("/{id}")
    public ResponseEntity<TransactionResponse> getTransactionById(
            @PathVariable Long id,
            @RequestHeader(name = "X-User-Id", required = false) String userId,
            @RequestHeader(name = "Authorization", required = false) String authHeader) {

        String uid = resolveUserId(userId, authHeader);
        log.info("Getting transaction {} for user: {}", id, uid);
        return ResponseEntity.ok(transactionService.getTransactionById(id, uid));
    }

    @PostMapping
    public ResponseEntity<TransactionResponse> createTransaction(
            @RequestBody CreateTransactionRequest request,
            @RequestHeader(name = "X-User-Id", required = false) String userId,
            @RequestHeader(name = "Authorization", required = false) String authHeader) {

        String uid = resolveUserId(userId, authHeader);
        log.info("Creating transaction for user: {}", uid);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(transactionService.createTransaction(request, uid));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TransactionResponse> updateTransaction(
            @PathVariable Long id,
            @RequestBody CreateTransactionRequest request,
            @RequestHeader(name = "X-User-Id", required = false) String userId,
            @RequestHeader(name = "Authorization", required = false) String authHeader) {

        String uid = resolveUserId(userId, authHeader);
        log.info("Updating transaction {} for user: {}", id, uid);
        return ResponseEntity.ok(transactionService.updateTransaction(id, request, uid));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTransaction(
            @PathVariable Long id,
            @RequestHeader(name = "X-User-Id", required = false) String userId,
            @RequestHeader(name = "Authorization", required = false) String authHeader) {

        String uid = resolveUserId(userId, authHeader);
        log.info("Deleting transaction {} for user: {}", id, uid);
        transactionService.deleteTransaction(id, uid);
        return ResponseEntity.noContent().build();
    }

    /**
     * Resolves the user ID from headers.
     * In development mode, provides a default user ID if none is present.
     */
    private String resolveUserId(String xUserId, String authHeader) {
        // First try X-User-Id header
        if (xUserId != null && !xUserId.isBlank()) {
            log.debug("Using X-User-Id from header: {}", xUserId);
            return xUserId;
        }

        // Try to extract from Authorization header (if JWT)
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            log.debug("Found Authorization header but not extracting user ID yet");
        }

        // Development fallback: Use a default user ID
        if ("dev".equals(environment) || "development".equals(environment)) {
            String defaultUserId = "dev-user-123";
            log.warn("⚠️ DEV MODE: No X-User-Id found, using default: {}", defaultUserId);
            return defaultUserId;
        }

        // Production: require X-User-Id
        log.error("Missing X-User-Id header and not in dev mode");
        throw new IllegalStateException(
                "Missing X-User-Id header. Gateway must inject user ID or set app.environment=dev");
    }
}