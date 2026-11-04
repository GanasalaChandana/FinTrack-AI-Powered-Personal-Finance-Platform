package com.fintrack.transactions.service;

import com.fintrack.budgets.exception.ResourceNotFoundException;
import com.fintrack.transactions.dto.*;
import com.fintrack.transactions.entity.Transaction;
import com.fintrack.transactions.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final CategoryRuleService categoryRules;

    @Transactional
    public TransactionResponse createTransaction(CreateTransactionRequest request, String userId) {
        log.info("Creating transaction for user: {}", userId);

        Transaction transaction = new Transaction();
        transaction.setUserId(userId);
        transaction.setDescription(request.getDescription());
        transaction.setAmount(request.getAmount());
        transaction.setMerchant(request.getMerchant());
        transaction.setType(normalizeType(request.getType()));
        transaction.setDate(request.getDate() != null ? request.getDate() : LocalDate.now());

        // Auto-categorize if category not provided
        if (request.getCategory() == null || request.getCategory().isEmpty()) {
            // The user's own category for this merchant if they set one before, else keyword rules
            String category = categoryRules.suggest(userId, request.getMerchant(), request.getDescription(),
                    request.getAmount(), request.getType());
            transaction.setCategory(category);
            log.info("Auto-categorized as: {}", category);
        } else {
            transaction.setCategory(request.getCategory());
        }

        transaction.setStatus(request.getStatus() != null ? request.getStatus() : "completed");
        transaction.setNotes(request.getNotes());
        transaction.setTags(request.getTags());
        transaction.setPaymentMethod(blankToNull(request.getPaymentMethod()));
        transaction.setCreatedAt(LocalDateTime.now());
        transaction.setUpdatedAt(LocalDateTime.now());

        Transaction saved = transactionRepository.save(transaction);
        log.info("Transaction created with ID: {}", saved.getId());

        return mapToResponse(saved);
    }

    @Transactional
    public TransactionResponse createTransaction(TransactionRequest request, String userId) {
        log.info("Creating transaction from DTO for user: {}", userId);

        Transaction transaction = new Transaction();
        transaction.setUserId(userId);
        transaction.setDescription(request.getDescription());
        transaction.setAmount(request.getAmount());
        transaction.setMerchant(request.getMerchant());
        transaction.setType(normalizeType(request.getType()));
        transaction.setDate(request.getDate() != null ? request.getDate() : LocalDate.now());
        transaction.setNotes(request.getNotes());
        transaction.setPaymentMethod(blankToNull(request.getPaymentMethod()));

        // Auto-categorize if category not provided
        if (request.getCategory() == null || request.getCategory().isEmpty()) {
            // The user's own category for this merchant if they set one before, else keyword rules
            String category = categoryRules.suggest(userId, request.getMerchant(), request.getDescription(),
                    request.getAmount(), request.getType());
            transaction.setCategory(category);
        } else {
            transaction.setCategory(request.getCategory());
        }

        transaction.setStatus("completed");
        transaction.setCreatedAt(LocalDateTime.now());
        transaction.setUpdatedAt(LocalDateTime.now());

        Transaction saved = transactionRepository.save(transaction);
        log.info("Transaction created with ID: {}", saved.getId());

        return mapToResponse(saved);
    }

    public Page<TransactionResponse> getTransactions(String userId, Pageable pageable) {
        log.info("Fetching transactions for user: {}", userId);
        return transactionRepository.findByUserId(userId, pageable)
                .map(this::mapToResponse);
    }

    public Page<TransactionResponse> getTransactionsWithFilters(
            String userId, String type, String category,
            LocalDate startDate, LocalDate endDate, String search, Pageable pageable) {
        log.info("Fetching filtered transactions for user: {}", userId);
        return transactionRepository.findByFilters(userId, type, category, startDate, endDate, search, pageable)
                .map(this::mapToResponse);
    }

    public TransactionResponse getTransactionById(Long id, String userId) {
        log.info("Fetching transaction with ID: {} for user: {}", id, userId);
        Transaction transaction = transactionRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found"));
        return mapToResponse(transaction);
    }

    @Transactional
    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    /** Stored as INCOME/EXPENSE — report queries match the type exactly. */
    private static String normalizeType(String type) {
        return type == null ? null : type.trim().toUpperCase(java.util.Locale.ROOT);
    }

    public TransactionResponse updateTransaction(Long id, CreateTransactionRequest request, String userId) {
        log.info("Updating transaction with ID: {} for user: {}", id, userId);

        Transaction transaction = transactionRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found"));

        // A changed category is remembered for this merchant's future transactions
        String newCategory = request.getCategory();
        if (newCategory != null && !newCategory.isBlank() && !newCategory.equals(transaction.getCategory())) {
            categoryRules.learn(userId, request.getMerchant(), request.getDescription(), newCategory);
        }

        transaction.setDescription(request.getDescription());
        transaction.setAmount(request.getAmount());
        transaction.setMerchant(request.getMerchant());
        transaction.setCategory(request.getCategory());
        transaction.setType(normalizeType(request.getType()));
        transaction.setDate(request.getDate());
        if (request.getStatus() != null) {
            transaction.setStatus(request.getStatus());
        }
        transaction.setNotes(request.getNotes());
        transaction.setTags(request.getTags());
        transaction.setPaymentMethod(blankToNull(request.getPaymentMethod()));
        transaction.setUpdatedAt(LocalDateTime.now());

        Transaction updated = transactionRepository.save(transaction);
        log.info("Transaction updated: {}", updated.getId());

        return mapToResponse(updated);
    }

    @Transactional
    public void deleteTransaction(Long id, String userId) {
        log.info("Deleting transaction with ID: {} for user: {}", id, userId);
        Transaction transaction = transactionRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found"));
        transactionRepository.delete(transaction);
        log.info("Transaction deleted: {}", id);
    }

    public Map<String, Object> getTransactionSummary(String userId, LocalDate startDate, LocalDate endDate) {
        log.info("Calculating transaction summary for user: {}", userId);

        Pageable pageable = Pageable.unpaged();
        Page<Transaction> transactions = transactionRepository.findByFilters(
                userId, null, null, startDate, endDate, null, pageable);

        BigDecimal totalIncome = BigDecimal.ZERO;
        BigDecimal totalExpenses = BigDecimal.ZERO;
        long transactionCount = transactions.getTotalElements();

        for (Transaction transaction : transactions.getContent()) {
            if ("INCOME".equalsIgnoreCase(transaction.getType())) {
                totalIncome = totalIncome.add(transaction.getAmount());
            } else {
                totalExpenses = totalExpenses.add(transaction.getAmount());
            }
        }

        BigDecimal balance = totalIncome.subtract(totalExpenses);

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalIncome", totalIncome);
        summary.put("totalExpenses", totalExpenses);
        summary.put("balance", balance);
        summary.put("transactionCount", transactionCount);

        return summary;
    }

    private TransactionResponse mapToResponse(Transaction transaction) {
        return TransactionResponse.builder()
                .id(transaction.getId())
                .userId(transaction.getUserId())
                .description(transaction.getDescription())
                .amount(transaction.getAmount())
                .merchant(transaction.getMerchant())
                .category(transaction.getCategory())
                .type(transaction.getType())
                .date(transaction.getDate())
                .createdAt(transaction.getCreatedAt())
                .updatedAt(transaction.getUpdatedAt())
                .status(transaction.getStatus() != null ? transaction.getStatus() : "completed")
                .notes(transaction.getNotes())
                .tags(transaction.getTags())
                .paymentMethod(transaction.getPaymentMethod())
                .build();
    }

    public List<TransactionResponse> getAllTransactions(String userId) {
        log.info("Fetching all transactions for user: {}", userId);
        return transactionRepository
                .findByUserId(userId, Pageable.unpaged())
                .getContent()
                .stream()
                .sorted((a, b) -> b.getDate().compareTo(a.getDate())) // ensure desc by date
                .map(this::mapToResponse)
                .toList();
    }

    public CategoryRuleService.Suggestion classifyTransaction(String userId, String merchant, String description,
                                                             java.math.BigDecimal amount, String type) {
        return categoryRules.suggestDetailed(userId, merchant, description, amount, type);
    }

    /**
     * Sets the category on all of the user's transactions from the same merchant
     * (and remembers it for future ones). Returns how many were changed.
     */
    @Transactional
    public int recategorizeMerchant(String userId, String merchant, String category) {
        String key = CategoryRuleService.key(merchant, null);
        if (key == null || category == null || category.isBlank()) return 0;
        categoryRules.learn(userId, merchant, null, category);
        int changed = 0;
        for (Transaction t : transactionRepository.findByUserId(userId)) {
            if (key.equals(CategoryRuleService.key(t.getMerchant(), t.getDescription()))
                    && !category.equals(t.getCategory())) {
                t.setCategory(category);
                t.setUpdatedAt(LocalDateTime.now());
                transactionRepository.save(t);
                changed++;
            }
        }
        return changed;
    }

    public Map<String, Object> getSummary(String userId, String startDate, String endDate) {
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : LocalDate.now().minusMonths(1);
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : LocalDate.now();
        return getTransactionSummary(userId, start, end);
    }
}
