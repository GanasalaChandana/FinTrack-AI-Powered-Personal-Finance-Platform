package com.fintrack.notifications.entity;

import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "notification_settings")
public class NotificationSettings {

    @Id
    @Column(length = 128)
    private String userId;

    @Builder.Default
    private boolean emailEnabled = true;
    @Builder.Default
    private boolean pushEnabled = true;
    @Builder.Default
    private boolean budgetAlertsEnabled = true;
    @Builder.Default
    private boolean transactionAlertsEnabled = true;
    @Builder.Default
    private boolean systemNotificationsEnabled = true;

    // Settings → Notifications (budgetAlertsEnabled and transactionAlertsEnabled above
    // are "Budget alerts" and "Large transactions")
    @Builder.Default
    private boolean weeklyDigest = false;
    @Builder.Default
    private boolean goalMilestones = true;
    @Builder.Default
    private boolean monthlyReport = true;
    @Builder.Default
    private boolean unusualSpending = true;
    @Builder.Default
    @Column(precision = 12, scale = 2, nullable = false)
    private java.math.BigDecimal largeTransactionThreshold = new java.math.BigDecimal("500");
    /** ISO 4217 code of the user's display currency (Settings → Preferences) */
    @Builder.Default
    @Column(length = 3, nullable = false)
    private String currency = "USD";
}
