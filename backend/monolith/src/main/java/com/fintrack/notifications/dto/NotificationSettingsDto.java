package com.fintrack.notifications.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;

import java.math.BigDecimal;

/**
 * A user's notification choices. On update, a field left out (null) keeps its
 * current value, so a client can send only what it changed.
 */
public record NotificationSettingsDto(
        String userId,
        Boolean emailEnabled,
        Boolean pushEnabled,
        Boolean budgetAlertsEnabled,
        Boolean transactionAlertsEnabled,
        Boolean systemNotificationsEnabled,
        Boolean weeklyDigest,
        Boolean goalMilestones,
        Boolean monthlyReport,
        Boolean unusualSpending,
        @DecimalMin("0") @DecimalMax("1000000000") BigDecimal largeTransactionThreshold) {
}
