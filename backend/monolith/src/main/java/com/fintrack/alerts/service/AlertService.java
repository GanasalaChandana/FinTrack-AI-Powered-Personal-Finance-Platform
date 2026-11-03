package com.fintrack.alerts.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import com.fintrack.alerts.entity.Alert;
import com.fintrack.alerts.repository.AlertRepository;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;

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
            alert.setDedupeKey(userId + "|" + category + "|" + type + "|" + YearMonth.now());
            try {
                alertRepository.save(alert);
                log.debug("Alert created for userId={} type={}", userId, type);
            } catch (DataIntegrityViolationException e) {
                // Another run created the same alert between our check and insert
                log.debug("Alert already created concurrently for userId={} type={}", userId, type);
            }
        } else {
            log.debug("Alert already exists for userId={} type={}", userId, type);
        }
    }
}
