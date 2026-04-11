package com.fintrack.transactions.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class TransactionResponse {
    private Long id;
    private String userId;
    private String description;
    private BigDecimal amount;
    private String merchant;
    private String category;
    private Double mlConfidence;
    private String type;
    private LocalDate date;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String status;
}
