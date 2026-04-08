package com.fintrack.transactions.controller;

import com.fintrack.transactions.dto.TransactionDTO;
import com.fintrack.transactions.dto.TransactionRequest;
import com.fintrack.transactions.dto.TransactionResponse;
import com.fintrack.transactions.service.TransactionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
public class TransactionUploadController {

    private final TransactionService transactionService;

    private static final DateTimeFormatter[] DATE_FORMATTERS = {
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd"),
            DateTimeFormatter.ofPattern("M/d/yyyy"),
            DateTimeFormatter.ofPattern("d/M/yyyy")
    };

    private static final long MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

    @PostMapping("/upload")
    public ResponseEntity<?> uploadTransactions(
            @RequestParam("file") MultipartFile file,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        if (userId == null || userId.isBlank()) {
            log.warn("POST /api/transactions/upload rejected: missing X-User-Id");
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }

        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            log.warn("CSV upload rejected: file size {} bytes exceeds 5 MB limit", file.getSize());
            return ResponseEntity.status(413).body(Map.of("error", "File exceeds maximum allowed size of 5 MB"));
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || !originalFilename.toLowerCase().endsWith(".csv")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only CSV files are allowed"));
        }

        try {
            List<TransactionDTO> transactions = parseCSV(file, userId);

            // Save all transactions
            List<TransactionResponse> savedTransactions = new ArrayList<>();
            int successCount = 0;
            int errorCount = 0;
            List<String> errors = new ArrayList<>();

            for (int i = 0; i < transactions.size(); i++) {
                try {
                    TransactionDTO dto = transactions.get(i);
                    // Convert DTO to Request
                    TransactionRequest request = new TransactionRequest(
                            dto.getDescription(),
                            dto.getAmount(),
                            dto.getMerchantName(),
                            dto.getCategory(),
                            dto.getType(),
                            dto.getDate());
                    TransactionResponse saved = transactionService.createTransaction(request, userId);
                    savedTransactions.add(saved);
                    successCount++;
                } catch (Exception e) {
                    errorCount++;
                    errors.add("Row " + (i + 2) + ": " + e.getMessage());
                    log.error("Error saving transaction at row {}: {}", i + 2, e.getMessage());
                }
            }

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("totalRows", transactions.size());
            response.put("successCount", successCount);
            response.put("errorCount", errorCount);
            response.put("transactions", savedTransactions);

            if (!errors.isEmpty()) {
                response.put("errors", errors);
            }

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error processing CSV file", e);
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Failed to process CSV: " + e.getMessage()));
        }
    }

    private List<TransactionDTO> parseCSV(MultipartFile file, String userId) throws Exception {
        List<TransactionDTO> transactions = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
                CSVParser csvParser = new CSVParser(reader,
                        CSVFormat.DEFAULT.builder()
                                .setHeader()
                                .setSkipHeaderRecord(true)
                                .setIgnoreHeaderCase(true)
                                .setTrim(true)
                                .build())) {

            for (CSVRecord record : csvParser) {
                try {
                    TransactionDTO transaction = new TransactionDTO();

                    transaction.setUserId(userId);

                    // Parse date
                    String dateStr = getColumnValue(record, "date", "transaction_date", "txn_date");
                    transaction.setDate(parseDate(dateStr));

                    // Parse description
                    String description = getColumnValue(record, "description", "desc", "merchant", "name");
                    transaction.setDescription(description != null ? description : "Unknown");

                    // Parse amount
                    String amountStr = getColumnValue(record, "amount", "value", "price", "total");
                    BigDecimal amount = parseAmount(amountStr);
                    transaction.setAmount(amount);

                    // Parse category
                    String category = getColumnValue(record, "category", "type", "class");
                    transaction.setCategory(category != null ? category : "Other");

                    // Parse transaction type (optional)
                    String typeStr = getColumnValue(record, "type", "transaction_type", "txn_type");
                    if (typeStr != null && typeStr.equalsIgnoreCase("INCOME")) {
                        transaction.setType("INCOME");
                    } else {
                        // Default to EXPENSE
                        transaction.setType("EXPENSE");
                    }

                    // Optional: merchant name
                    String merchantName = getColumnValue(record, "merchant_name", "merchant", "vendor");
                    transaction.setMerchantName(merchantName);

                    // Optional: notes
                    String notes = getColumnValue(record, "notes", "memo", "comment");
                    transaction.setNotes(notes);

                    transactions.add(transaction);

                } catch (Exception e) {
                    log.warn("Skipping invalid row {}: {}", record.getRecordNumber(), e.getMessage());
                }
            }
        }

        return transactions;
    }

    private String getColumnValue(CSVRecord record, String... possibleNames) {
        for (String name : possibleNames) {
            try {
                if (record.isMapped(name)) {
                    String value = record.get(name);
                    if (value != null && !value.trim().isEmpty()) {
                        return value.trim();
                    }
                }
            } catch (IllegalArgumentException e) {
                // Column doesn't exist, try next
            }
        }
        return null;
    }

    private LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isEmpty()) {
            return LocalDate.now();
        }

        for (DateTimeFormatter formatter : DATE_FORMATTERS) {
            try {
                return LocalDate.parse(dateStr, formatter);
            } catch (Exception e) {
                // Try next formatter
            }
        }

        throw new IllegalArgumentException("Unable to parse date: " + dateStr);
    }

    private BigDecimal parseAmount(String amountStr) {
        if (amountStr == null || amountStr.isEmpty()) {
            throw new IllegalArgumentException("Amount is required");
        }

        // Remove currency symbols and whitespace
        String cleaned = amountStr.replaceAll("[^0-9.-]", "");

        try {
            return new BigDecimal(cleaned).abs(); // Always use absolute value
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid amount: " + amountStr);
        }
    }
}
