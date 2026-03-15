package com.fintrack.alerts.service;

import com.fintrack.alerts.entity.AlertHistory;
import com.fintrack.alerts.entity.NotificationLog;
import com.fintrack.alerts.repository.NotificationLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@Slf4j
public class AlertNotificationService {

    private final JavaMailSender mailSender;
    private final NotificationLogRepository notificationLogRepository;

    @Autowired
    public AlertNotificationService(
            @Autowired(required = false) JavaMailSender mailSender,
            NotificationLogRepository notificationLogRepository) {
        this.mailSender = mailSender;
        this.notificationLogRepository = notificationLogRepository;
    }

    @Async
    public void sendNotification(AlertHistory alert) {
        log.info("Sending notification for alert {}", alert.getId());

        // Send email notification
        sendEmailNotification(alert);

        // Could add SMS, push notifications here
    }

    private void sendEmailNotification(AlertHistory alert) {
        NotificationLog notificationLog = new NotificationLog();
        notificationLog.setAlertId(alert.getId());
        notificationLog.setChannel(NotificationLog.Channel.EMAIL);
        notificationLog.setStatus(NotificationLog.Status.PENDING);

        try {
            // In production, fetch user email from user service
            String recipientEmail = "user@example.com"; // Placeholder
            notificationLog.setRecipient(recipientEmail);

            // Check if mail sender is configured
            if (mailSender == null) {
                log.warn("JavaMailSender not configured. Skipping email for alert {}", alert.getId());
                notificationLog.setStatus(NotificationLog.Status.FAILED);
                notificationLog.setErrorMessage("Email service not configured");
                notificationLogRepository.save(notificationLog);
                return;
            }

            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(recipientEmail);
            message.setSubject("FinTrack Alert: " + alert.getAlertType());
            message.setText(buildEmailBody(alert));

            mailSender.send(message);

            notificationLog.setStatus(NotificationLog.Status.SENT);
            notificationLog.setSentAt(LocalDateTime.now());
            log.info("Email sent successfully for alert {}", alert.getId());

        } catch (Exception e) {
            notificationLog.setStatus(NotificationLog.Status.FAILED);
            notificationLog.setErrorMessage(e.getMessage());
            log.error("Failed to send email for alert {}", alert.getId(), e);
        } finally {
            notificationLogRepository.save(notificationLog);
        }
    }

    private String buildEmailBody(AlertHistory alert) {
        return String.format("""
                Hi,

                You have a new %s alert from FinTrack:

                %s

                Severity: %s
                Time: %s

                Log in to FinTrack to view details.

                Best regards,
                FinTrack Team
                """,
                alert.getAlertType(),
                alert.getMessage(),
                alert.getSeverity(),
                alert.getCreatedAt());
    }
}
