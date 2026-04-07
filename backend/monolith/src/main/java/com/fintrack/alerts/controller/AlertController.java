package com.fintrack.alerts.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.fintrack.alerts.service.AlertService;
import com.fintrack.alerts.service.BudgetAlertScheduler;
import com.fintrack.alerts.entity.Alert;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/alerts")
public class AlertController {

    @Autowired
    private AlertService alertService;

    @Autowired(required = false)
    private BudgetAlertScheduler budgetAlertScheduler;

    @GetMapping
    public ResponseEntity<List<Alert>> getAllAlerts(
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        log.debug("GET /api/alerts - userId: {}", userId);
        try {
            List<Alert> alerts = (userId != null && !userId.isBlank())
                    ? alertService.getAlertsByUserId(userId)
                    : alertService.getAllAlerts();
            log.debug("Returning {} alerts for userId={}", alerts.size(), userId);
            return ResponseEntity.ok(alerts);
        } catch (Exception e) {
            log.error("Error fetching alerts for userId={}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Alert> getAlertById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(alertService.getAlertById(id));
        } catch (RuntimeException e) {
            log.warn("Alert not found: {}", id);
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Alert>> getAlertsByUserId(@PathVariable String userId) {
        try {
            return ResponseEntity.ok(alertService.getAlertsByUserId(userId));
        } catch (Exception e) {
            log.error("Error fetching alerts for userId={}: {}", userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping
    public ResponseEntity<Alert> createAlert(
            @RequestBody Alert alert,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        try {
            if (alert.getMessage() == null || alert.getMessage().isBlank()) {
                log.warn("createAlert rejected - missing message");
                return ResponseEntity.badRequest().build();
            }
            // Stamp userId from header if not already set
            if (userId != null && !userId.isBlank() && alert.getUserId() == null) {
                alert.setUserId(userId);
            }
            Alert created = alertService.createAlert(alert);
            log.debug("Alert created id={} for userId={}", created.getId(), userId);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (Exception e) {
            log.error("Error creating alert: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Alert> updateAlert(@PathVariable Long id, @RequestBody Alert alert) {
        try {
            return ResponseEntity.ok(alertService.updateAlert(id, alert));
        } catch (RuntimeException e) {
            log.warn("Alert not found for update: {}", id);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error updating alert {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAlert(@PathVariable Long id) {
        try {
            alertService.deleteAlert(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            log.error("Error deleting alert {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<Alert> updateAlertStatus(@PathVariable Long id, @RequestParam String status) {
        try {
            return ResponseEntity.ok(alertService.updateAlertStatus(id, status));
        } catch (RuntimeException e) {
            log.warn("Alert not found for status update: {}", id);
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{id}/acknowledge")
    public ResponseEntity<Alert> acknowledgeAlert(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        try {
            return ResponseEntity.ok(alertService.acknowledgeAlert(id));
        } catch (RuntimeException e) {
            log.warn("Alert not found for acknowledge: {}", id);
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/acknowledge-all")
    public ResponseEntity<Map<String, Object>> acknowledgeAll(
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        try {
            int count = (userId != null && !userId.isBlank())
                    ? alertService.acknowledgeAllByUserId(userId)
                    : alertService.acknowledgeAllAlerts();
            log.debug("Acknowledged {} alerts for userId={}", count, userId);
            return ResponseEntity.ok(Map.of("acknowledged", count, "success", true));
        } catch (Exception e) {
            log.error("Error acknowledging all alerts: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/trigger-check")
    public ResponseEntity<Map<String, String>> triggerBudgetCheck() {
        if (budgetAlertScheduler != null) {
            budgetAlertScheduler.checkBudgetAlerts();
            return ResponseEntity.ok(Map.of("status", "triggered", "message", "Check completed"));
        }
        return ResponseEntity.ok(Map.of("status", "skipped", "message", "Scheduler not available"));
    }
}
