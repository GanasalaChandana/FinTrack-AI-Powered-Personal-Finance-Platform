package com.fintrack.budgets.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "goals")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Goal {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId; // Changed from Long to String to match Budget entity

    @Column(nullable = false)
    private String name;

    @Column(name = "target_amount", nullable = false, precision = 15, scale = 2)
    @JsonProperty("target")
    private BigDecimal targetAmount;

    @Column(name = "current_amount", precision = 15, scale = 2)
    @JsonProperty("current")
    @Builder.Default
    private BigDecimal currentAmount = BigDecimal.ZERO;

    private LocalDate deadline;

    private String category;

    @Column(nullable = false)
    @Builder.Default
    private String icon = "🎯";

    @Column(nullable = false)
    @Builder.Default
    private String color = "#10b981";

    @Column(name = "monthly_contribution", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal monthlyContribution = BigDecimal.ZERO;

    @Column(nullable = false)
    @Builder.Default
    private Boolean achieved = false;

    /** Highest milestone (25/50/75/100) the owner was notified about; each is sent once */
    @Column(name = "milestone_notified", nullable = false)
    @Builder.Default
    @com.fasterxml.jackson.annotation.JsonIgnore
    private int milestoneNotified = 0;

    /** The highest milestone reached now: 0, 25, 50, 75 or 100. */
    public int currentMilestone() {
        if (targetAmount == null || targetAmount.signum() <= 0 || currentAmount == null) return 0;
        java.math.BigDecimal pct = currentAmount.multiply(java.math.BigDecimal.valueOf(100));
        for (int m : new int[]{100, 75, 50, 25}) {
            if (pct.compareTo(targetAmount.multiply(java.math.BigDecimal.valueOf(m))) >= 0) return m;
        }
        return 0;
    }

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Calculated field for frontend
    @Transient
    public double getProgress() {
        if (targetAmount == null || targetAmount.compareTo(BigDecimal.ZERO) == 0) {
            return 0;
        }
        if (currentAmount == null) {
            return 0;
        }
        return currentAmount.divide(targetAmount, 4, java.math.RoundingMode.HALF_UP)
                .multiply(new BigDecimal(100))
                .doubleValue();
    }

    // Helper method to check if goal is achieved
    @Transient
    public boolean isGoalAchieved() {
        return currentAmount != null && targetAmount != null
                && currentAmount.compareTo(targetAmount) >= 0;
    }
}
