package com.fintrack.notifications.repository;

import com.fintrack.notifications.entity.NotificationSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationSettingsRepository extends JpaRepository<NotificationSettings, String> {

    java.util.List<NotificationSettings> findByWeeklyDigestTrueAndEmailEnabledTrue();

    java.util.List<NotificationSettings> findByMonthlyReportTrueAndEmailEnabledTrue();
}
