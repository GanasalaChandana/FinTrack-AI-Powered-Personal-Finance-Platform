package com.fintrack.transactions.controller;

import com.fintrack.transactions.dto.TransactionResponse;
import com.fintrack.transactions.dto.CreateTransactionRequest;
import com.fintrack.transactions.service.TransactionService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    private static final int DEFAULT_TRANSACTION_LIMIT = 500;
    private static final int MAX_TRANSACTION_LIMIT     = 2000;

    @GetMapping
    public ResponseEntity<List<TransactionResponse>> getAllTransactions(
            @RequestParam(required = false) Integer limit,
            @RequestHeader(name = "X-User-Id", required = false) String userId) {

        if (userId == null || userId.isBlank()) {
            log.warn("GET /api/transactions rejected: missing X-User-Id");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        int effectiveLimit = (limit != null && limit > 0)
                ? Math.min(limit, MAX_TRANSACTION_LIMIT)
                : DEFAULT_TRANSACTION_LIMIT;

        log.debug("Getting transactions for user: {} (limit: {})", userId, effectiveLimit);

        List<TransactionResponse> transactions = transactionService.getAllTransactions(userId);

        if (transactions.size() > effectiveLimit) {
            transactions = transactions.subList(0, effectiveLimit);
        }

        return ResponseEntity.ok(transactions);
    }

    // ⚠️ IMPORTANT: Specific routes MUST come BEFORE generic path variable routes
    // Move all specific endpoints (classify, summary, health) BEFORE /{id}

    @PostMapping("/classify")
    public ResponseEntity<Map<String, String>> classifyTransaction(
            @RequestBody Map<String, String> request,
            @RequestHeader(name = "X-User-Id", required = false) String userId) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String description = request.get("description");
        log.debug("Classifying transaction for user: {}", userId);
        String category = transactionService.classifyTransaction(description);
        return ResponseEntity.ok(Map.of("category", category));
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestHeader(name = "X-User-Id", required = false) String userId) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        log.debug("Getting transaction summary for user: {}", userId);
        return ResponseEntity.ok(transactionService.getSummary(userId, startDate, endDate));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        log.debug("Health check called");
        return ResponseEntity.ok(Map.of("status", "UP", "service", "transactions-service"));
    }

    // NOW the generic /{id} route comes AFTER all specific routes
    @GetMapping("/{id}")
    public ResponseEntity<TransactionResponse> getTransactionById(
            @PathVariable Long id,
            @RequestHeader(name = "X-User-Id", required = false) String userId) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        log.debug("Getting transaction {} for user: {}", id, userId);
        return ResponseEntity.ok(transactionService.getTransactionById(id, userId));
    }

    @PostMapping
    public ResponseEntity<TransactionResponse> createTransaction(
            @RequestBody CreateTransactionRequest request,
            @RequestHeader(name = "X-User-Id", required = false) String userId) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        log.debug("Creating transaction for user: {}", userId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(transactionService.createTransaction(request, userId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TransactionResponse> updateTransaction(
            @PathVariable Long id,
            @RequestBody CreateTransactionRequest request,
            @RequestHeader(name = "X-User-Id", required = false) String userId) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        log.debug("Updating transaction {} for user: {}", id, userId);
        return ResponseEntity.ok(transactionService.updateTransaction(id, request, userId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTransaction(
            @PathVariable Long id,
            @RequestHeader(name = "X-User-Id", required = false) String userId) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        log.debug("Deleting transaction {} for user: {}", id, userId);
        transactionService.deleteTransaction(id, userId);
        return ResponseEntity.noContent().build();
    }
}
