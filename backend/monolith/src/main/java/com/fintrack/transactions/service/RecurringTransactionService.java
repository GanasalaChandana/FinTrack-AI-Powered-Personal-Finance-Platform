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
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
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
        recurring.setFrequency(checkedFrequency(request.getFrequency()));
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
        recurring.setFrequency(checkedFrequency(request.getFrequency()));
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
    // Re-running is safe: each occurrence is keyed by (rule, date), and ShedLock stops two
    // instances running the job at the same time.
    @Scheduled(fixedDelay = 3600000, initialDelay = 120000)
    @SchedulerLock(name = "recurringTransactions", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
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
        // Idempotent: a retry after a crash (or an overlapping run) must not duplicate an occurrence
        if (transactionRepository.existsByRecurringIdAndDate(recurring.getId(), recurring.getNextOccurrence())) {
            log.info("Occurrence {} of recurring ID {} already exists, skipping", recurring.getNextOccurrence(), recurring.getId());
            return;
        }
        Transaction transaction = new Transaction();
        transaction.setRecurringId(recurring.getId());
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
        LocalDate nextDate = calculateNextOccurrence(recurring.getNextOccurrence(), recurring.getFrequency(), anchorDay(recurring));
        recurring.setNextOccurrence(nextDate);

        // Deactivate if past end date
        if (recurring.getEndDate() != null && nextDate.isAfter(recurring.getEndDate())) {
            recurring.setActive(false);
        }

        recurringTransactionRepository.save(recurring);
    }

    public static final java.util.Set<String> FREQUENCIES =
            java.util.Set.of("DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "YEARLY");

    /** The day of the month a monthly/quarterly/yearly rule falls on (from its start date). */
    private static int anchorDay(RecurringTransaction r) {
        LocalDate start = r.getStartDate() != null ? r.getStartDate() : r.getNextOccurrence();
        return start.getDayOfMonth();
    }

    /**
     * Next date after {@code current}. Month-based rules keep their day of the month:
     * a rule on the 31st goes Jan 31 → Feb 28 → Mar 31 (it used to stay on the 28th).
     */
    static LocalDate calculateNextOccurrence(LocalDate current, String frequency, int anchorDay) {
        return switch (frequency == null ? "MONTHLY" : frequency.toUpperCase(java.util.Locale.ROOT)) {
            case "DAILY" -> current.plusDays(1);
            case "WEEKLY" -> current.plusWeeks(1);
            case "BIWEEKLY" -> current.plusWeeks(2);
            case "QUARTERLY" -> onDay(current.plusMonths(3), anchorDay);
            case "YEARLY" -> onDay(current.plusYears(1), anchorDay);
            default -> onDay(current.plusMonths(1), anchorDay);
        };
    }

    private static LocalDate onDay(LocalDate inMonth, int day) {
        return inMonth.withDayOfMonth(Math.min(day, inMonth.lengthOfMonth()));
    }

    /**
     * Pause or resume a rule. Resuming continues from the next date that is today or
     * later, rather than creating every occurrence missed while paused.
     */
    @Transactional
    public RecurringTransactionResponse setActive(Long id, String userId, boolean active) {
        RecurringTransaction r = recurringTransactionRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Recurring transaction not found"));
        if (active && !Boolean.TRUE.equals(r.getActive())) {
            LocalDate today = LocalDate.now();
            int guard = 0;
            while (r.getNextOccurrence().isBefore(today) && guard++ < 2000) {
                r.setNextOccurrence(calculateNextOccurrence(r.getNextOccurrence(), r.getFrequency(), anchorDay(r)));
            }
            if (r.getEndDate() != null && r.getNextOccurrence().isAfter(r.getEndDate())) {
                throw new com.fintrack.common.BadRequestException("This rule has ended; change its end date to resume it");
            }
        }
        r.setActive(active);
        r.setUpdatedAt(LocalDateTime.now());
        return mapToResponse(recurringTransactionRepository.save(r));
    }

    private static String checkedFrequency(String f) {
        String up = f == null ? "" : f.trim().toUpperCase(java.util.Locale.ROOT);
        if (!FREQUENCIES.contains(up)) {
            throw new com.fintrack.common.BadRequestException("Frequency must be one of " + FREQUENCIES);
        }
        return up;
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
