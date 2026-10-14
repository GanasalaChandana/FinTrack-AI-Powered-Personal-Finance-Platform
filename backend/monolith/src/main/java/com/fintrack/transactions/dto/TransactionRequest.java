package com.fintrack.transactions.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TransactionRequest {
    private String description;
    private BigDecimal amount;
    private String merchant;
    private String category;
    private String type;
    private LocalDate date;
    private String notes;
    private String paymentMethod;

    public TransactionRequest(String description, BigDecimal amount, String merchant,
                              String category, String type, LocalDate date) {
        this(description, amount, merchant, category, type, date, null, null);
    }
}
