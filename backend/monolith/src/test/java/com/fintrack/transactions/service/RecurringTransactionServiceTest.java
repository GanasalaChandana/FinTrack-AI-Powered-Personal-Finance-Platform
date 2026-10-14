package com.fintrack.transactions.service;

import com.fintrack.transactions.entity.RecurringTransaction;
import com.fintrack.transactions.entity.Transaction;
import com.fintrack.transactions.repository.RecurringTransactionRepository;
import com.fintrack.transactions.repository.TransactionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("RecurringTransactionService.processRecurringTransactions")
class RecurringTransactionServiceTest {

    @Mock private RecurringTransactionRepository recurringRepo;
    @Mock private TransactionRepository transactionRepo;
    @InjectMocks private RecurringTransactionService service;

    private RecurringTransaction rule(LocalDate next, String frequency, LocalDate end) {
        RecurringTransaction r = new RecurringTransaction();
        r.setId(1L);
        r.setUserId("u1");
        r.setDescription("Gym");
        r.setAmount(BigDecimal.valueOf(30));
        r.setCategory("Health");
        r.setType("expense");
        r.setFrequency(frequency);
        r.setNextOccurrence(next);
        r.setEndDate(end);
        r.setActive(true);
        return r;
    }

    @Test
    @DisplayName("catches up on every missed occurrence in one run")
    void catchesUp() {
        LocalDate today = LocalDate.now();
        RecurringTransaction weekly = rule(today.minusWeeks(3), "WEEKLY", null);
        when(recurringRepo.findDueRecurringTransactions(any())).thenReturn(List.of(weekly));

        service.processRecurringTransactions();

        ArgumentCaptor<Transaction> saved = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepo, times(4)).save(saved.capture()); // 3 weeks ago, 2, 1, today
        assertThat(saved.getAllValues()).extracting(Transaction::getDate)
                .containsExactly(today.minusWeeks(3), today.minusWeeks(2), today.minusWeeks(1), today);
        assertThat(saved.getValue().getType()).isEqualTo("EXPENSE");
        assertThat(weekly.getNextOccurrence()).isEqualTo(today.plusWeeks(1));
    }

    @Test
    @DisplayName("stops at the end date")
    void stopsAtEndDate() {
        LocalDate today = LocalDate.now();
        RecurringTransaction daily = rule(today.minusDays(5), "DAILY", today.minusDays(3));
        when(recurringRepo.findDueRecurringTransactions(any())).thenReturn(List.of(daily));

        service.processRecurringTransactions();

        verify(transactionRepo, times(3)).save(any(Transaction.class)); // -5, -4, -3
        assertThat(daily.getActive()).isFalse();
    }
}
