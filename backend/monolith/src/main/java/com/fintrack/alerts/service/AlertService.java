package com.fintrack.alerts.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.fintrack.alerts.entity.Alert;
import com.fintrack.alerts.repository.AlertRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
public class AlertService {

    @Autowired
    private AlertRepository alertRepository;

    // ─── Basic CRUD ───────────────────────────────────────────────────────────

    public List<Alert> getAllAlerts() {
        return alertRepository.findAll();
    }

    public Alert getAlertById(Long id) {
        return alertRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Alert not found: " + id));
    }

    public List<Alert> getAlertsByUserId(String userId) {
        return alertRepository.findByUserId(userId);
    }

    public Alert createAlert(Alert alert) {
        return alertRepository.save(alert);
    }

    public Alert updateAlert(Long id, Alert alert) {
        Alert existing = getAlertById(id);
        existing.setMessage(alert.getMessage());
        existing.setType(alert.getType());
        existing.setStatus(alert.getStatus());
        existing.setPriority(alert.getPriority());
        return alertRepository.save(existing);
    }

    public void deleteAlert(Long id) {
        alertRepository.deleteById(id);
    }

    public Alert updateAlertStatus(Long id, String status) {
        Alert alert = getAlertById(id);
        alert.setStatus(status);
        return alertRepository.save(alert);
    }

    // ─── Kafka helpers (UUID → String) ───────────────────────────────────────

    public void createBudgetExceededAlert(UUID userId, String category, double spent, double budget) {
        Alert alert = new Alert();
        alert.setUserId(userId.toString());
        alert.setType("BUDGET_EXCEEDED");
        alert.setMessage(String.format("Budget exceeded for %s: $%.2f spent (Budget: $%.2f)", category, spent, budget));
        alert.setStatus("UNREAD");
        alert.setPriority("HIGH");
        alertRepository.save(alert);
    }

    public void createBudgetWarningAlert(UUID userId, String category, double spent, double budget, double percentage) {
        Alert alert = new Alert();
        alert.setUserId(userId.toString());
        alert.setType("BUDGET_WARNING");
        alert.setMessage(String.format("Budget warning for %s: $%.2f spent (%.0f%% of $%.2f budget)", category, spent,
                percentage, budget));
        alert.setStatus("UNREAD");
        alert.setPriority("MEDIUM");
        alertRepository.save(alert);
    }

    public void createGoalMilestoneAlert(UUID userId, UUID goalId, String goalName, double progress) {
        Alert alert = new Alert();
        alert.setUserId(userId.toString());
        alert.setType("GOAL_MILESTONE");
        alert.setMessage(String.format("Goal milestone reached for '%s': %.0f%% complete", goalName, progress));
        alert.setStatus("UNREAD");
        alert.setPriority("MEDIUM");
        alertRepository.save(alert);
    }

    public void createGoalAchievedAlert(UUID userId, UUID goalId, String goalName) {
        Alert alert = new Alert();
        alert.setUserId(userId.toString());
        alert.setType("GOAL_ACHIEVED");
        alert.setMessage(String.format("Congratulations! Goal '%s' has been achieved!", goalName));
        alert.setStatus("UNREAD");
        alert.setPriority("HIGH");
        alertRepository.save(alert);
    }

    public void createUnusualSpendingAlert(UUID userId, String category, double amount, double average) {
        Alert alert = new Alert();
        alert.setUserId(userId.toString());
        alert.setType("UNUSUAL_SPENDING");
        alert.setMessage(
                String.format("Unusual spending detected in %s: $%.2f (Average: $%.2f)", category, amount, average));
        alert.setStatus("UNREAD");
        alert.setPriority("MEDIUM");
        alertRepository.save(alert);
    }

    // ─── Acknowledge ──────────────────────────────────────────────────────────

    public Alert acknowledgeAlert(Long id) {
        Alert alert = getAlertById(id);
        alert.setRead(true);
        alert.setAcknowledged(true);
        return alertRepository.save(alert);
    }

    public int acknowledgeAllByUserId(String userId) {
        List<Alert> unread = alertRepository.findByUserIdAndReadFalse(userId);
        unread.forEach(a -> {
            a.setRead(true);
            a.setAcknowledged(true);
        });
        alertRepository.saveAll(unread);
        return unread.size();
    }

    public int acknowledgeAllAlerts() {
        List<Alert> unread = alertRepository.findByReadFalse();
        unread.forEach(a -> {
            a.setRead(true);
            a.setAcknowledged(true);
        });
        alertRepository.saveAll(unread);
        return unread.size();
    }

    // ─── Dedup-safe creation ──────────────────────────────────────────────────

    public void createAlertIfNotExists(String userId, String category,
            String type, String title, String message, String severity) {

        LocalDateTime startOfMonth = LocalDateTime.now()
                .withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);

        boolean exists = alertRepository.existsByUserIdAndCategoryAndTypeAndCreatedAtAfter(
                userId, category, type, startOfMonth);

        if (!exists) {
            Alert alert = new Alert();
            alert.setUserId(userId);
            alert.setTitle(title);
            alert.setMessage(message);
            alert.setType(type);
            alert.setSeverity(severity);
            alert.setCategory(category);
            alert.setRead(false);
            alert.setAcknowledged(false);
            alert.setCreatedAt(LocalDateTime.now());
            alertRepository.save(alert);
            log.debug("Alert created for userId={} type={}", userId, type);
        } else {
            log.debug("Alert already exists for userId={} type={}", userId, type);
        }
    }
}
