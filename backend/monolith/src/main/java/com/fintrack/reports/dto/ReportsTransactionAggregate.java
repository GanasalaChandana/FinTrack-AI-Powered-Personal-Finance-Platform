package com.fintrack.reports.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReportsTransactionAggregate {
    private String category;
    private BigDecimal totalAmount;
    private Long transactionCount;
}
