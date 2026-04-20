package com.fintrack.reports.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "transaction_aggregates")
@Data
@AllArgsConstructor
@NoArgsConstructor
public class TransactionAggregate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "aggregation_date", nullable = false)
    private LocalDate aggregationDate;

    @Column(name = "aggregation_type", nullable = false, length = 20)
    private String aggregationType;

    @Column(length = 100)
    private String category;

    @Column(name = "total_amount", precision = 15, scale = 2, nullable = false)
    private BigDecimal totalAmount;

    @Column(name = "transaction_count", nullable = false)
    private Integer transactionCount;

    @Column(name = "avg_amount", precision = 15, scale = 2)
    private BigDecimal avgAmount;

    @Column(name = "max_amount", precision = 15, scale = 2)
    private BigDecimal maxAmount;

    @Column(name = "min_amount", precision = 15, scale = 2)
    private BigDecimal minAmount;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
