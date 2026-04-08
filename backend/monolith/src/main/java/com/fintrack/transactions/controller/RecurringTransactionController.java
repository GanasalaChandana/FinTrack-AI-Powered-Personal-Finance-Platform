package com.fintrack.transactions.controller;

import com.fintrack.transactions.dto.CreateRecurringTransactionRequest;
import com.fintrack.transactions.dto.RecurringTransactionResponse;
import com.fintrack.transactions.service.RecurringTransactionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/recurring-transactions")
@RequiredArgsConstructor
@Slf4j
public class RecurringTransactionController {

    private final RecurringTransactionService recurringTransactionService;

    @PostMapping
    public ResponseEntity<RecurringTransactionResponse> createRecurringTransaction(
            @RequestHeader("X-User-Id") String userId,
            @RequestBody CreateRecurringTransactionRequest request) {
        log.info("Creating recurring transaction for user: {}", userId);
        RecurringTransactionResponse response = recurringTransactionService.createRecurringTransaction(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<Page<RecurringTransactionResponse>> getRecurringTransactions(
            @RequestHeader("X-User-Id") String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        log.info("Fetching recurring transactions for user: {}", userId);
        Page<RecurringTransactionResponse> transactions = recurringTransactionService.getRecurringTransactions(
                userId, PageRequest.of(page, size));
        return ResponseEntity.ok(transactions);
    }

    @GetMapping("/{id}")
    public ResponseEntity<RecurringTransactionResponse> getRecurringTransaction(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable Long id) {
        log.info("Fetching recurring transaction {} for user: {}", id, userId);
        RecurringTransactionResponse transaction = recurringTransactionService.getRecurringTransactionById(id, userId);
        return ResponseEntity.ok(transaction);
    }

    @PutMapping("/{id}")
    public ResponseEntity<RecurringTransactionResponse> updateRecurringTransaction(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable Long id,
            @RequestBody CreateRecurringTransactionRequest request) {
        log.info("Updating recurring transaction {} for user: {}", id, userId);
        RecurringTransactionResponse response = recurringTransactionService.updateRecurringTransaction(id, request, userId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRecurringTransaction(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable Long id) {
        log.info("Deleting recurring transaction {} for user: {}", id, userId);
        recurringTransactionService.deleteRecurringTransaction(id, userId);
        return ResponseEntity.noContent().build();
    }

    // NOTE: /process was removed — recurring transaction processing is handled
    // exclusively by the scheduled job (@Scheduled in RecurringTransactionService).
    // Exposing it as a public endpoint allowed any authenticated user to trigger
    // global processing for all users, which is both a security and resource risk.
}
