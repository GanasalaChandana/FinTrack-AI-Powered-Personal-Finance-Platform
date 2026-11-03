package com.fintrack.transactions.controller;

import com.fintrack.transactions.dto.CreateTransactionRequest;
import com.fintrack.transactions.entity.ImportJob;
import com.fintrack.transactions.service.TransactionImportService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Background import of many transactions at once.
 *
 *   POST /api/transactions/import        {"transactions":[...]}  -> 202 {"jobId", "total", ...}
 *   GET  /api/transactions/import/{id}                            -> progress
 */
@RestController
@RequestMapping("/api/transactions/import")
@RequiredArgsConstructor
public class TransactionImportController {

    private final TransactionImportService importService;

    @Data
    public static class ImportRequest {
        private List<CreateTransactionRequest> transactions;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> start(
            @RequestBody ImportRequest request,
            @RequestHeader(name = "X-User-Id", required = false) String userId) {
        if (userId == null || userId.isBlank()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        List<CreateTransactionRequest> rows = request.getTransactions();
        if (rows == null || rows.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "No transactions to import"));
        }
        if (rows.size() > TransactionImportService.MAX_ROWS) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of(
                    "message", "At most " + TransactionImportService.MAX_ROWS + " transactions per import"));
        }
        try {
            ImportJob job = importService.start(userId, rows);
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(view(job));
        } catch (TransactionImportService.BusyException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .header("Retry-After", "60").body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/{jobId}")
    public ResponseEntity<Map<String, Object>> status(
            @PathVariable UUID jobId,
            @RequestHeader(name = "X-User-Id", required = false) String userId) {
        if (userId == null || userId.isBlank()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        // Someone else's job looks exactly like a missing one
        return importService.find(jobId, userId)
                .map(job -> ResponseEntity.ok(view(job)))
                .orElse(ResponseEntity.notFound().build());
    }

    private static Map<String, Object> view(ImportJob job) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("jobId", job.getId());
        m.put("status", job.getStatus().name());
        m.put("total", job.getTotal());
        m.put("processed", job.getProcessed());
        m.put("imported", job.getImported());
        m.put("failed", job.getFailed());
        if (job.getError() != null) m.put("error", job.getError());
        return m;
    }
}
