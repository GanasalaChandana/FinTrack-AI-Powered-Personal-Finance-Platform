package com.fintrack.transactions.service;

import com.fintrack.budgets.exception.ResourceNotFoundException;
import com.fintrack.transactions.dto.CreateRecurringTransactionRequest;
import com.fintrack.transactions.dto.RecurringTransactionResponse;
import com.fintrack.transactions.entity.RecurringTransaction;
import com.fintrack.transactions.entity.Transaction;
import com.fintrack.transactions.repository.RecurringTransactionRepository;
import com.fintrack.transactions.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class RecurringTransactionService {

    private final RecurringTransactionRepository recurringTransactionRepository;
    private final TransactionRepository transactionRepository;

    @Transactional
    public RecurringTransactionResponse createRecurringTransaction(
            CreateRecurringTransactionRequest request, String userId) {
        log.info("Creating recurring transaction for user: {}", userId);

        RecurringTransaction recurring = new RecurringTransaction();
        recurring.setUserId(userId);
        recurring.setDescription(request.getDescription());
        recurring.setAmount(request.getAmount());
        recurring.setMerchant(request.getMerchant());
        recurring.setCategory(request.getCategory());
        recurring.setType(request.getType());
        recurring.setFrequency(request.getFrequency());
        recurring.setStartDate(request.getStartDate());
        recurring.setEndDate(request.getEndDate());
        recurring.setNextOccurrence(request.getStartDate());
        recurring.setActive(true);
        recurring.setCreatedAt(LocalDateTime.now());
        recurring.setUpdatedAt(LocalDateTime.now());

        RecurringTransaction saved = recurringTransactionRepository.save(recurring);
        log.info("Recurring transaction created with ID: {}", saved.getId());

        return mapToResponse(saved);
    }

    public Page<RecurringTransactionResponse> getRecurringTransactions(String userId, Pageable pageable) {
        log.info("Fetching recurring transactions for user: {}", userId);
        return recurringTransactionRepository.findByUserId(userId, pageable)
                .map(this::mapToResponse);
    }

    public RecurringTransactionResponse getRecurringTransactionById(Long id, String userId) {
        log.info("Fetching recurring transaction with ID: {} for user: {}", id, userId);
        RecurringTransaction recurring = recurringTransactionRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Recurring transaction not found"));
        return mapToResponse(recurring);
    }

    @Transactional
    public RecurringTransactionResponse updateRecurringTransaction(
            Long id, CreateRecurringTransactionRequest request, String userId) {
        log.info("Updating recurring transaction with ID: {} for user: {}", id, userId);

        RecurringTransaction recurring = recurringTransactionRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Recurring transaction not found"));

        recurring.setDescription(request.getDescription());
        recurring.setAmount(request.getAmount());
        recurring.setMerchant(request.getMerchant());
        recurring.setCategory(request.getCategory());
        recurring.setType(request.getType());
        recurring.setFrequency(request.getFrequency());
        recurring.setEndDate(request.getEndDate());
        recurring.setUpdatedAt(LocalDateTime.now());

        RecurringTransaction updated = recurringTransactionRepository.save(recurring);
        log.info("Recurring transaction updated: {}", updated.getId());

        return mapToResponse(updated);
    }

    @Transactional
    public void deleteRecurringTransaction(Long id, String userId) {
        log.info("Deleting recurring transaction with ID: {} for user: {}", id, userId);
        RecurringTransaction recurring = recurringTransactionRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Recurring transaction not found"));
        recurringTransactionRepository.delete(recurring);
        log.info("Recurring transaction deleted: {}", id);
    }

    // Hourly (first run 2 min after start-up) instead of once at 2 AM: the host
    // sleeps when idle, so a single nightly run was often missed entirely.
    // Re-running is safe — each occurrence is created once, then nextOccurrence moves on.
    @Scheduled(fixedDelay = 3600000, initialDelay = 120000)
    @Transactional
    public void processRecurringTransactions() {
        LocalDate today = LocalDate.now();
        List<RecurringTransaction> dueTransactions =
            recurringTransactionRepository.findDueRecurringTransactions(today);

        int created = 0;
        for (RecurringTransaction recurring : dueTransactions) {
            try {
                // Catch up on every missed occurrence, not just one per run
                int guard = 0;
                while (!Boolean.FALSE.equals(recurring.getActive())
                        && !recurring.getNextOccurrence().isAfter(today)
                        && guard++ < 400) {
                    createTransactionFromRecurring(recurring);
                    created++;
                    updateNextOccurrence(recurring);
                }
            } catch (Exception e) {
                log.error("Error processing recurring transaction {}: {}", recurring.getId(), e.getMessage());
            }
        }

        if (created > 0) log.info("Created {} transactions from {} recurring rules", created, dueTransactions.size());
    }

    private void createTransactionFromRecurring(RecurringTransaction recurring) {
        Transaction transaction = new Transaction();
        transaction.setUserId(recurring.getUserId());
        transaction.setDescription(recurring.getDescription());
        transaction.setAmount(recurring.getAmount());
        transaction.setMerchant(recurring.getMerchant());
        transaction.setCategory(recurring.getCategory());
        transaction.setType(recurring.getType() == null ? null : recurring.getType().toUpperCase(java.util.Locale.ROOT));
        transaction.setDate(recurring.getNextOccurrence());
        transaction.setCreatedAt(LocalDateTime.now());
        transaction.setUpdatedAt(LocalDateTime.now());

        transactionRepository.save(transaction);
        log.info("Created transaction from recurring ID: {}", recurring.getId());
    }

    private void updateNextOccurrence(RecurringTransaction recurring) {
        LocalDate nextDate = calculateNextOccurrence(recurring.getNextOccurrence(), recurring.getFrequency());
        recurring.setNextOccurrence(nextDate);

        // Deactivate if past end date
        if (recurring.getEndDate() != null && nextDate.isAfter(recurring.getEndDate())) {
            recurring.setActive(false);
        }

        recurringTransactionRepository.save(recurring);
    }

    private LocalDate calculateNextOccurrence(LocalDate current, String frequency) {
        return switch (frequency.toUpperCase()) {
            case "DAILY" -> current.plusDays(1);
            case "WEEKLY" -> current.plusWeeks(1);
            case "MONTHLY" -> current.plusMonths(1);
            case "YEARLY" -> current.plusYears(1);
            default -> current.plusMonths(1);
        };
    }

    private RecurringTransactionResponse mapToResponse(RecurringTransaction recurring) {
        return RecurringTransactionResponse.builder()
                .id(recurring.getId())
                .userId(recurring.getUserId())
                .description(recurring.getDescription())
                .amount(recurring.getAmount())
                .merchant(recurring.getMerchant())
                .category(recurring.getCategory())
                .type(recurring.getType())
                .frequency(recurring.getFrequency())
                .startDate(recurring.getStartDate())
                .endDate(recurring.getEndDate())
                .nextOccurrence(recurring.getNextOccurrence())
                .active(recurring.getActive())
                .createdAt(recurring.getCreatedAt())
                .updatedAt(recurring.getUpdatedAt())
                .build();
    }
}
