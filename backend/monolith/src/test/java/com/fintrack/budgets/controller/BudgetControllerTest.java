package com.fintrack.budgets.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fintrack.auth.security.JwtUtil;
import com.fintrack.budgets.entity.Budget;
import com.fintrack.budgets.exception.ResourceNotFoundException;
import com.fintrack.budgets.exception.UnauthorizedException;
import com.fintrack.budgets.service.BudgetsService;
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

import java.time.YearMonth;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller slice tests for BudgetController.
 * Security is disabled so we can focus on HTTP contract only.
 */
@WebMvcTest(
    controllers = BudgetController.class,
    excludeAutoConfiguration = SecurityAutoConfiguration.class
)
@ActiveProfiles("test")
@DisplayName("BudgetController")
class BudgetControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private BudgetsService budgetsService;

    // Required so @WebMvcTest can wire the JwtAuthenticationFilter in SecurityConfig
    @MockBean
    @SuppressWarnings("unused")
    private JwtUtil jwtUtil;

    private static final String USER_ID = "user-42";
    private static final String MONTH   = YearMonth.now().toString();

    private Budget sampleBudget(Long id) {
        return Budget.builder()
                .id(id)
                .userId(USER_ID)
                .category("Groceries")
                .budget(400.0)
                .spent(120.0)
                .month(MONTH)
                .icon("🛒")
                .color("#3b82f6")
                .period("monthly")
                .isActive(true)
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/budgets
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("GET /api/budgets")
    class GetAllBudgets {

        @Test
        @DisplayName("returns 401 when X-User-Id header is missing")
        void missingHeader_returns401() throws Exception {
            mockMvc.perform(get("/api/budgets"))
                    .andExpect(status().isUnauthorized());

            verifyNoInteractions(budgetsService);
        }

        @Test
        @DisplayName("returns 200 with budget list for valid user")
        void validUser_returnsBudgets() throws Exception {
            when(budgetsService.getAllBudgetsByUserId(USER_ID, null))
                    .thenReturn(List.of(sampleBudget(1L), sampleBudget(2L)));

            mockMvc.perform(get("/api/budgets")
                            .header("X-User-Id", USER_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2))
                    .andExpect(jsonPath("$[0].category").value("Groceries"));
        }

        @Test
        @DisplayName("filters by month query param")
        void filtersByMonth() throws Exception {
            when(budgetsService.getAllBudgetsByUserId(USER_ID, MONTH))
                    .thenReturn(List.of(sampleBudget(1L)));

            mockMvc.perform(get("/api/budgets")
                            .header("X-User-Id", USER_ID)
                            .param("month", MONTH))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1));

            verify(budgetsService).getAllBudgetsByUserId(USER_ID, MONTH);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/budgets/summary
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("GET /api/budgets/summary")
    class GetSummary {

        @Test
        @DisplayName("returns 401 without user header")
        void missingHeader_returns401() throws Exception {
            mockMvc.perform(get("/api/budgets/summary"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns summary map with correct keys")
        void returnsSummary() throws Exception {
            Map<String, Object> summary = Map.of(
                    "totalBudget", 800.0,
                    "totalSpent",  320.0,
                    "remaining",   480.0,
                    "percentage",  40.0,
                    "month",       MONTH
            );
            when(budgetsService.getBudgetSummary(USER_ID, null)).thenReturn(summary);

            mockMvc.perform(get("/api/budgets/summary")
                            .header("X-User-Id", USER_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalBudget").value(800.0))
                    .andExpect(jsonPath("$.remaining").value(480.0));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/budgets/{id}
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("GET /api/budgets/{id}")
    class GetById {

        @Test
        @DisplayName("returns budget for valid user and id")
        void returnsById() throws Exception {
            when(budgetsService.getBudgetById("1", USER_ID)).thenReturn(sampleBudget(1L));

            mockMvc.perform(get("/api/budgets/1")
                            .header("X-User-Id", USER_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(1))
                    .andExpect(jsonPath("$.userId").value(USER_ID));
        }

        @Test
        @DisplayName("returns 404 when budget does not exist")
        void returns404WhenNotFound() throws Exception {
            when(budgetsService.getBudgetById("999", USER_ID))
                    .thenThrow(new ResourceNotFoundException("Budget not found"));

            mockMvc.perform(get("/api/budgets/999")
                            .header("X-User-Id", USER_ID))
                    .andExpect(status().isNotFound());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/budgets
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("POST /api/budgets")
    class CreateBudget {

        @Test
        @DisplayName("creates budget and returns 201")
        void creates_returns201() throws Exception {
            Budget newBudget = sampleBudget(null);
            Budget created   = sampleBudget(10L);

            when(budgetsService.createBudget(any(Budget.class))).thenReturn(created);

            mockMvc.perform(post("/api/budgets")
                            .header("X-User-Id", USER_ID)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(newBudget)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").value(10));
        }

        @Test
        @DisplayName("returns 401 without X-User-Id")
        void returns401WithoutHeader() throws Exception {
            mockMvc.perform(post("/api/budgets")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(sampleBudget(null))))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns 400 for invalid period value")
        void returns400ForInvalidPeriod() throws Exception {
            Budget budget = sampleBudget(null);
            budget.setPeriod("invalid-period");

            mockMvc.perform(post("/api/budgets")
                            .header("X-User-Id", USER_ID)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(budget)))
                    .andExpect(status().isBadRequest());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /api/budgets/{id}/spent
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("PATCH /api/budgets/{id}/spent")
    class UpdateSpent {

        @Test
        @DisplayName("updates spent and returns updated budget")
        void updatesSpent() throws Exception {
            Budget updated = sampleBudget(1L);
            updated.setSpent(250.0);
            when(budgetsService.updateSpent("1", 250.0, USER_ID)).thenReturn(updated);

            mockMvc.perform(patch("/api/budgets/1/spent")
                            .header("X-User-Id", USER_ID)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"spent\": 250.0}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.spent").value(250.0));
        }

        @Test
        @DisplayName("returns 400 when spent is negative")
        void returns400ForNegativeSpent() throws Exception {
            mockMvc.perform(patch("/api/budgets/1/spent")
                            .header("X-User-Id", USER_ID)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"spent\": -10.0}"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 when spent field is missing from body")
        void returns400ForMissingSpent() throws Exception {
            mockMvc.perform(patch("/api/budgets/1/spent")
                            .header("X-User-Id", USER_ID)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /api/budgets/{id}
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("DELETE /api/budgets/{id}")
    class DeleteBudget {

        @Test
        @DisplayName("deletes budget and returns success message")
        void deletesSuccessfully() throws Exception {
            doNothing().when(budgetsService).deleteBudget("1", USER_ID);

            mockMvc.perform(delete("/api/budgets/1")
                            .header("X-User-Id", USER_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Budget deleted successfully"));
        }

        @Test
        @DisplayName("returns 500 when budget belongs to another user (service throws)")
        void returns500ForWrongUser() throws Exception {
            doThrow(new UnauthorizedException("Forbidden"))
                    .when(budgetsService).deleteBudget("1", USER_ID);

            mockMvc.perform(delete("/api/budgets/1")
                            .header("X-User-Id", USER_ID))
                    .andExpect(status().isInternalServerError());
        }
    }
}
