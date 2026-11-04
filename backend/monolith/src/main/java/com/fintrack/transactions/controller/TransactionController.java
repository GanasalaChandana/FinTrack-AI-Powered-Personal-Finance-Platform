package com.fintrack.transactions.controller;

import com.fintrack.transactions.dto.TransactionResponse;
import com.fintrack.transactions.dto.CreateTransactionRequest;
import com.fintrack.transactions.repository.TransactionRepository;
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
public class TransactionController {

    private final TransactionService    transactionService;
    private final TransactionRepository transactionRepository;
    private final com.fintrack.transactions.ml.CategoryModelService categoryModelService;

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

    /**
     * Body: {"merchant", "description", "amount", "type"} (all optional).
     * Returns {category, source: learned|model|keywords, confidence 0..1}.
     */
    @PostMapping("/classify")
    public ResponseEntity<Map<String, Object>> classifyTransaction(
            @RequestBody Map<String, Object> request,
            @RequestHeader(name = "X-User-Id", required = false) String userId) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        java.math.BigDecimal amount = null;
        try {
            Object a = request.get("amount");
            if (a != null && !a.toString().isBlank()) amount = new java.math.BigDecimal(a.toString());
        } catch (NumberFormatException ignored) { /* amount is optional */ }
        var s = transactionService.classifyTransaction(userId,
                (String) request.get("merchant"), (String) request.get("description"),
                amount, (String) request.get("type"));
        return ResponseEntity.ok(Map.of("category", s.category(), "source", s.source(), "confidence", s.confidence()));
    }

    /** How well the category model does on this user's own transactions (5-fold cross-validation). */
    @GetMapping("/category-model")
    public ResponseEntity<com.fintrack.transactions.ml.CategoryModelService.Stats> categoryModelStats(
            @RequestHeader(name = "X-User-Id", required = false) String userId) {
        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(categoryModelService.stats(userId));
    }

    /** Body: {"merchant": "...", "category": "..."}. Recategorizes that merchant's transactions. */
    @PostMapping("/recategorize")
    public ResponseEntity<Map<String, Object>> recategorizeMerchant(
            @RequestBody Map<String, String> request,
            @RequestHeader(name = "X-User-Id", required = false) String userId) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String merchant = request.get("merchant");
        String category = request.get("category");
        if (merchant == null || merchant.isBlank() || category == null || category.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "merchant and category are required"));
        }
        int updated = transactionService.recategorizeMerchant(userId, merchant, category.trim());
        return ResponseEntity.ok(Map.of("updated", updated));
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

    /** Delete every transaction belonging to the authenticated user. Used by CSV import "replace" mode. */
    @DeleteMapping("/all")
    public ResponseEntity<Map<String, String>> deleteAllTransactions(
            @RequestHeader(name = "X-User-Id", required = false) String userId) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        transactionRepository.deleteAllByUserId(userId);
        log.info("Deleted all transactions for user {}", userId);
        return ResponseEntity.ok(Map.of("message", "All transactions deleted"));
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
