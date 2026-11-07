package com.fintrack.notifications.service;

import com.fintrack.notifications.dto.NotificationSettingsDto;
import com.fintrack.notifications.entity.NotificationSettings;
import com.fintrack.notifications.repository.NotificationSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.function.Consumer;

@Service
@RequiredArgsConstructor
@Transactional
public class NotificationSettingsService {

    private final NotificationSettingsRepository repo;

    /** The user's settings, created with the defaults on first use. */
    public NotificationSettingsDto get(String userId) {
        // Not read-only: the first call stores the defaults
        return toDto(entity(userId));
    }

    /** Updates the fields that are set (non-null) in the DTO. */
    public NotificationSettingsDto update(String userId, NotificationSettingsDto dto) {
        NotificationSettings s = entity(userId);
        set(dto.emailEnabled(), s::setEmailEnabled);
        set(dto.pushEnabled(), s::setPushEnabled);
        set(dto.budgetAlertsEnabled(), s::setBudgetAlertsEnabled);
        set(dto.transactionAlertsEnabled(), s::setTransactionAlertsEnabled);
        set(dto.systemNotificationsEnabled(), s::setSystemNotificationsEnabled);
        set(dto.weeklyDigest(), s::setWeeklyDigest);
        set(dto.goalMilestones(), s::setGoalMilestones);
        set(dto.monthlyReport(), s::setMonthlyReport);
        set(dto.unusualSpending(), s::setUnusualSpending);
        set(dto.largeTransactionThreshold(), s::setLargeTransactionThreshold);
        return toDto(repo.save(s));
    }

    public NotificationSettingsDto reset(String userId) {
        return toDto(repo.save(NotificationSettings.builder().userId(userId).build()));
    }

    private NotificationSettings entity(String userId) {
        return repo.findById(userId)
                .orElseGet(() -> repo.save(NotificationSettings.builder().userId(userId).build()));
    }

    private static <T> void set(T value, Consumer<T> setter) {
        if (value != null) setter.accept(value);
    }

    private NotificationSettingsDto toDto(NotificationSettings s) {
        return new NotificationSettingsDto(
                s.getUserId(),
                s.isEmailEnabled(),
                s.isPushEnabled(),
                s.isBudgetAlertsEnabled(),
                s.isTransactionAlertsEnabled(),
                s.isSystemNotificationsEnabled(),
                s.isWeeklyDigest(),
                s.isGoalMilestones(),
                s.isMonthlyReport(),
                s.isUnusualSpending(),
                s.getLargeTransactionThreshold());
    }
}
