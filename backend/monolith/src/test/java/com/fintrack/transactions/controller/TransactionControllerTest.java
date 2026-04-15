package com.fintrack.transactions.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.fintrack.auth.security.JwtUtil;
import com.fintrack.transactions.dto.CreateTransactionRequest;
import com.fintrack.transactions.dto.TransactionResponse;
import com.fintrack.transactions.service.TransactionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller slice tests for TransactionController.
 */
@WebMvcTest(
    controllers = TransactionController.class,
    excludeAutoConfiguration = SecurityAutoConfiguration.class
)
@ActiveProfiles("test")
@DisplayName("TransactionController")
class TransactionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TransactionService transactionService;

    // Required so @WebMvcTest can wire the JwtAuthenticationFilter in SecurityConfig
    @MockBean
    @SuppressWarnings("unused")
    private JwtUtil jwtUtil;

    private ObjectMapper objectMapper;
    private static final String USER_ID = "user-txn-001";

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
    }

    private TransactionResponse sampleResponse(Long id, String type, double amount) {
        return TransactionResponse.builder()
                .id(id)
                .userId(USER_ID)
                .description("Sample transaction")
                .amount(BigDecimal.valueOf(amount))
                .merchant("Sample Merchant")
                .category("Food & Dining")
                .type(type)
                .date(LocalDate.now())
                .status("completed")
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/transactions
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("GET /api/transactions")
    class GetAllTransactions {

        @Test
        @DisplayName("returns 401 when X-User-Id header is missing")
        void missingHeader_returns401() throws Exception {
            mockMvc.perform(get("/api/transactions"))
                    .andExpect(status().isUnauthorized());

            verifyNoInteractions(transactionService);
        }

        @Test
        @DisplayName("returns 200 with list of transactions")
        void validUser_returnsTransactions() throws Exception {
            when(transactionService.getAllTransactions(USER_ID))
                    .thenReturn(List.of(
                            sampleResponse(1L, "EXPENSE", 45.00),
                            sampleResponse(2L, "INCOME",  3000.00)
                    ));

            mockMvc.perform(get("/api/transactions")
                            .header("X-User-Id", USER_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2))
                    .andExpect(jsonPath("$[0].userId").value(USER_ID));
        }

        @Test
        @DisplayName("returns empty array when user has no transactions")
        void emptyList() throws Exception {
            when(transactionService.getAllTransactions(USER_ID)).thenReturn(List.of());

            mockMvc.perform(get("/api/transactions")
                            .header("X-User-Id", USER_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(0));
        }

        @Test
        @DisplayName("respects limit query parameter (caps at MAX)")
        void respectsLimitParam() throws Exception {
            // Return 5 items, but limit=2 — controller should trim to 2
            List<TransactionResponse> five = List.of(
                    sampleResponse(1L, "EXPENSE", 10),
                    sampleResponse(2L, "EXPENSE", 20),
                    sampleResponse(3L, "EXPENSE", 30),
                    sampleResponse(4L, "EXPENSE", 40),
                    sampleResponse(5L, "EXPENSE", 50)
            );
            when(transactionService.getAllTransactions(USER_ID)).thenReturn(five);

            mockMvc.perform(get("/api/transactions")
                            .header("X-User-Id", USER_ID)
                            .param("limit", "2"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/transactions
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("POST /api/transactions")
    class CreateTransaction {

        @Test
        @DisplayName("creates transaction and returns 201")
        void creates_returns201() throws Exception {
            CreateTransactionRequest req = new CreateTransactionRequest();
            req.setDescription("Grocery run");
            req.setAmount(BigDecimal.valueOf(87.50));
            req.setMerchant("Whole Foods");
            req.setType("EXPENSE");
            req.setCategory("Groceries");
            req.setDate(LocalDate.now());

            TransactionResponse created = sampleResponse(5L, "EXPENSE", 87.50);
            when(transactionService.createTransaction(any(CreateTransactionRequest.class), eq(USER_ID)))
                    .thenReturn(created);

            mockMvc.perform(post("/api/transactions")
                            .header("X-User-Id", USER_ID)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").value(5));
        }

        @Test
        @DisplayName("returns 401 without user header")
        void returns401WithoutHeader() throws Exception {
            CreateTransactionRequest req = new CreateTransactionRequest();
            req.setDescription("Coffee");
            req.setAmount(BigDecimal.valueOf(4.50));
            req.setType("EXPENSE");

            mockMvc.perform(post("/api/transactions")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnauthorized());

            verifyNoInteractions(transactionService);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /api/transactions/{id}
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("DELETE /api/transactions/{id}")
    class DeleteTransaction {

        @Test
        @DisplayName("returns 204 on successful delete")
        void deletes_returns200() throws Exception {
            doNothing().when(transactionService).deleteTransaction(1L, USER_ID);

            mockMvc.perform(delete("/api/transactions/1")
                            .header("X-User-Id", USER_ID))
                    .andExpect(status().isNoContent()); // controller returns 204 No Content

            verify(transactionService).deleteTransaction(1L, USER_ID);
        }

        @Test
        @DisplayName("returns 401 without user header")
        void returns401WithoutHeader() throws Exception {
            mockMvc.perform(delete("/api/transactions/1"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns 500 when transaction not found (service throws)")
        void returns500WhenNotFound() throws Exception {
            doThrow(new RuntimeException("Transaction not found"))
                    .when(transactionService).deleteTransaction(999L, USER_ID);

            mockMvc.perform(delete("/api/transactions/999")
                            .header("X-User-Id", USER_ID))
                    .andExpect(status().isInternalServerError());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/transactions/summary
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("GET /api/transactions/summary")
    class Summary {

        @Test
        @DisplayName("returns 401 without user header")
        void missingHeader_returns401() throws Exception {
            mockMvc.perform(get("/api/transactions/summary"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns summary with income and expense totals")
        void returnsSummary() throws Exception {
            Map<String, Object> summary = Map.of(
                    "totalIncome",   new BigDecimal("5000"),
                    "totalExpenses", new BigDecimal("2500"),
                    "balance",       new BigDecimal("2500"),
                    "transactionCount", 10L
            );
            when(transactionService.getSummary(eq(USER_ID), any(), any())).thenReturn(summary);

            mockMvc.perform(get("/api/transactions/summary")
                            .header("X-User-Id", USER_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalIncome").value(5000))
                    .andExpect(jsonPath("$.transactionCount").value(10));
        }
    }
}
