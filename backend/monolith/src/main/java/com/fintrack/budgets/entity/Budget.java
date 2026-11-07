package com.fintrack.budgets.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "budgets")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Budget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private String userId; // Removed validation - set from header in controller

    @Column(nullable = false)
    @NotBlank(message = "Category is required")
    private String category;

    @Column(nullable = false)
    @NotNull(message = "Budget amount is required")
    @Min(value = 0, message = "Budget must be non-negative")
    private Double budget;

    @Builder.Default
    @Column(nullable = false)
    @Min(value = 0, message = "Spent amount must be non-negative")
    private Double spent = 0.0;

    @Column(nullable = false)
    private String month; // Removed @NotBlank - auto-set in controller if not provided

    @Builder.Default
    @Column(length = 10)
    private String icon = "💰";

    @Column(name = "period")
    private String period;

    @Builder.Default
    @Column(length = 20)
    private String color = "#3b82f6";

    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "start_date")
    private LocalDateTime startDate;

    @Column(name = "end_date")
    private LocalDateTime endDate;

    /**
     * The household this budget is shared with (null = personal). Set by the server
     * from the user's own household, never from the request body.
     */
    @Column(name = "household_id")
    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    private java.util.UUID householdId;

    /** Request-only: true to share with the user's household, false to make it personal. */
    @Transient
    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.WRITE_ONLY)
    private Boolean shareWithHousehold;

    /** Response-only: whether this budget is shared with the household. */
    @com.fasterxml.jackson.annotation.JsonProperty("shared")
    public boolean isSharedWithHousehold() {
        return householdId != null;
    }

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
}
