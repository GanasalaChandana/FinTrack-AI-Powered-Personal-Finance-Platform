package com.fintrack.transactions.service;

import com.fintrack.transactions.client.MLClassifierClient;
import com.fintrack.transactions.dto.CreateTransactionRequest;
import com.fintrack.transactions.dto.TransactionResponse;
import com.fintrack.transactions.entity.Transaction;
import com.fintrack.transactions.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for TransactionService.
 * Uses Mockito — no Spring context, no database.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("TransactionService")
class TransactionServiceTest {

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private MLClassifierClient mlClassifierClient;

    @InjectMocks
    private TransactionService transactionService;

    private static final String USER_ID = "user-abc";

    private Transaction buildTxn(Long id, String type, double amount, String category) {
        Transaction t = new Transaction();
        t.setId(id);
        t.setUserId(USER_ID);
        t.setDescription("Test transaction");
        t.setAmount(BigDecimal.valueOf(amount));
        t.setMerchant("Test Merchant");
        t.setCategory(category);
        t.setType(type);
        t.setDate(LocalDate.now());
        t.setStatus("completed");
        return t;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // createTransaction
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("createTransaction()")
    class CreateTransaction {

        @Test
        @DisplayName("saves transaction with provided category")
        void savesWithProvidedCategory() {
            CreateTransactionRequest req = new CreateTransactionRequest();
            req.setDescription("Starbucks coffee");
            req.setAmount(BigDecimal.valueOf(6.50));
            req.setMerchant("Starbucks");
            req.setType("EXPENSE");
            req.setCategory("Food & Dining");
            req.setDate(LocalDate.now());

            Transaction saved = buildTxn(1L, "EXPENSE", 6.50, "Food & Dining");
            when(transactionRepository.save(any(Transaction.class))).thenReturn(saved);

            TransactionResponse result = transactionService.createTransaction(req, USER_ID);

            assertThat(result).isNotNull();
            assertThat(result.getCategory()).isEqualTo("Food & Dining");
            // ML classifier should NOT be called when category is provided
            verify(mlClassifierClient, never()).classifyTransaction(anyString(), any(), anyString());
        }

        @Test
        @DisplayName("calls ML classifier when category is missing")
        void callsMLWhenNoCategoryProvided() {
            CreateTransactionRequest req = new CreateTransactionRequest();
            req.setDescription("Amazon purchase");
            req.setAmount(BigDecimal.valueOf(59.99));
            req.setMerchant("Amazon");
            req.setType("EXPENSE");
            // no category set
            req.setDate(LocalDate.now());

            when(mlClassifierClient.classifyTransaction(anyString(), any(), anyString()))
                    .thenReturn("Shopping");
            Transaction saved = buildTxn(2L, "EXPENSE", 59.99, "Shopping");
            when(transactionRepository.save(any())).thenReturn(saved);

            TransactionResponse result = transactionService.createTransaction(req, USER_ID);

            verify(mlClassifierClient).classifyTransaction(anyString(), any(), anyString());
            assertThat(result.getCategory()).isEqualTo("Shopping");
        }

        @Test
        @DisplayName("sets userId from parameter, not request body")
        void setsUserIdFromParameter() {
            CreateTransactionRequest req = new CreateTransactionRequest();
            req.setDescription("Salary");
            req.setAmount(BigDecimal.valueOf(5000));
            req.setType("INCOME");
            req.setCategory("Income");
            req.setDate(LocalDate.now());

            Transaction saved = buildTxn(3L, "INCOME", 5000, "Income");
            when(transactionRepository.save(argThat(t -> USER_ID.equals(t.getUserId()))))
                    .thenReturn(saved);

            transactionService.createTransaction(req, USER_ID);

            verify(transactionRepository).save(argThat(t -> USER_ID.equals(t.getUserId())));
        }

        @Test
        @DisplayName("defaults to today's date when request date is null")
        void defaultsToToday() {
            CreateTransactionRequest req = new CreateTransactionRequest();
            req.setDescription("Test");
            req.setAmount(BigDecimal.valueOf(10));
            req.setType("EXPENSE");
            req.setCategory("Other");
            req.setDate(null); // no date

            Transaction saved = buildTxn(4L, "EXPENSE", 10, "Other");
            when(transactionRepository.save(any())).thenReturn(saved);

            transactionService.createTransaction(req, USER_ID);

            verify(transactionRepository).save(argThat(t -> t.getDate() != null));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // getAllTransactions
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getAllTransactions()")
    class GetAllTransactions {

        @Test
        @DisplayName("returns all transactions sorted by date descending")
        void returnsSortedDescending() {
            Transaction older = buildTxn(1L, "EXPENSE", 20, "Food");
            older.setDate(LocalDate.of(2026, 3, 1));
            Transaction newer = buildTxn(2L, "INCOME", 100, "Income");
            newer.setDate(LocalDate.of(2026, 4, 1));

            Page<Transaction> page = new PageImpl<>(List.of(older, newer));
            when(transactionRepository.findByUserId(eq(USER_ID), any(Pageable.class))).thenReturn(page);

            List<TransactionResponse> result = transactionService.getAllTransactions(USER_ID);

            assertThat(result).hasSize(2);
            // newest first
            assertThat(result.get(0).getDate()).isAfterOrEqualTo(result.get(1).getDate());
        }

        @Test
        @DisplayName("returns empty list when user has no transactions")
        void returnsEmptyList() {
            when(transactionRepository.findByUserId(eq(USER_ID), any(Pageable.class)))
                    .thenReturn(Page.empty());

            List<TransactionResponse> result = transactionService.getAllTransactions(USER_ID);

            assertThat(result).isEmpty();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // deleteTransaction
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("deleteTransaction()")
    class DeleteTransaction {

        @Test
        @DisplayName("deletes owned transaction successfully")
        void deletesOwnTransaction() {
            Transaction txn = buildTxn(10L, "EXPENSE", 50, "Shopping");
            when(transactionRepository.findByIdAndUserId(10L, USER_ID)).thenReturn(Optional.of(txn));
            doNothing().when(transactionRepository).delete(txn);

            assertThatNoException().isThrownBy(
                    () -> transactionService.deleteTransaction(10L, USER_ID)
            );
            verify(transactionRepository).delete(txn);
        }

        @Test
        @DisplayName("throws RuntimeException when transaction not found or wrong user")
        void throwsWhenNotFound() {
            when(transactionRepository.findByIdAndUserId(999L, USER_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> transactionService.deleteTransaction(999L, USER_ID))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Transaction not found");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // getTransactionSummary
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getTransactionSummary()")
    class GetSummary {

        @Test
        @DisplayName("separates INCOME from EXPENSE in totals")
        void separatesIncomeAndExpense() {
            Transaction income  = buildTxn(1L, "INCOME",  3000, "Income");
            Transaction expense = buildTxn(2L, "EXPENSE", 1200, "Bills");
            Page<Transaction> page = new PageImpl<>(List.of(income, expense));

            when(transactionRepository.findByFilters(
                    eq(USER_ID), isNull(), isNull(), any(), any(), isNull(), any(Pageable.class)))
                    .thenReturn(page);

            Map<String, Object> summary = transactionService.getTransactionSummary(
                    USER_ID,
                    LocalDate.now().minusMonths(1),
                    LocalDate.now()
            );

            // Use isEqualByComparingTo to ignore BigDecimal scale ("3000" vs "3000.0")
            assertThat((BigDecimal) summary.get("totalIncome")).isEqualByComparingTo(new BigDecimal("3000"));
            assertThat((BigDecimal) summary.get("totalExpenses")).isEqualByComparingTo(new BigDecimal("1200"));
            assertThat(summary.get("transactionCount")).isEqualTo(2L);
        }

        @Test
        @DisplayName("balance is income minus expenses")
        void balanceIsIncomeMinusExpenses() {
            Transaction income  = buildTxn(1L, "INCOME",  2500, "Income");
            Transaction expense = buildTxn(2L, "EXPENSE", 1000, "Rent");
            Page<Transaction> page = new PageImpl<>(List.of(income, expense));

            when(transactionRepository.findByFilters(
                    anyString(), isNull(), isNull(), any(), any(), isNull(), any(Pageable.class)))
                    .thenReturn(page);

            Map<String, Object> summary = transactionService.getTransactionSummary(
                    USER_ID, LocalDate.now().minusMonths(1), LocalDate.now()
            );

            BigDecimal balance = (BigDecimal) summary.get("balance");
            assertThat(balance).isEqualByComparingTo(new BigDecimal("1500"));
        }
    }
}
