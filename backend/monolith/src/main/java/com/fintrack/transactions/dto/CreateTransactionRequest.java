package com.fintrack.transactions.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CreateTransactionRequest {
    @NotBlank
    private String description;

    @NotNull
    private BigDecimal amount;

    private String merchant;
    private String category;

    @NotBlank
    private String type;

    private LocalDate date;

    private String status; // "completed" or "pending", defaults to "completed"
}
