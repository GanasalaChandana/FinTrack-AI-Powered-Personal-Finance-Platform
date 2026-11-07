package com.fintrack.transactions.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CreateRecurringTransactionRequest {
    @NotBlank
    private String description;

    @NotNull
    private BigDecimal amount;

    private String merchant;
    private String category;

    @NotBlank
    private String type; // INCOME or EXPENSE

    @NotBlank
    private String frequency; // DAILY, WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, YEARLY

    @NotNull
    private LocalDate startDate;

    private LocalDate endDate;
}
