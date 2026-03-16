package com.fintrack.alerts.service;

import com.fintrack.alerts.entity.AlertHistory;
import com.fintrack.alerts.entity.AlertRule;
import com.fintrack.alerts.repository.AlertHistoryRepository;
import com.fintrack.alerts.repository.AlertRuleRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class AlertProcessingService {

    private final AlertRuleRepository alertRuleRepository;
    private final AlertHistoryRepository alertHistoryRepository;
    private final AlertNotificationService notificationService;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    @Nullable
    private StringRedisTemplate redisTemplate;

    @Value("${alert.rules.high-amount-threshold}")
    private BigDecimal highAmountThreshold;

    @Value("${alert.rules.rate-limit-window-seconds}")
    private int rateLimitWindow;

    @Value("${alert.rules.max-alerts-per-window}")
    private int maxAlertsPerWindow;

    public AlertProcessingService(
            AlertRuleRepository alertRuleRepository,
            AlertHistoryRepository alertHistoryRepository,
            AlertNotificationService notificationService,
            ObjectMapper objectMapper) {
        this.alertRuleRepository = alertRuleRepository;
        this.alertHistoryRepository = alertHistoryRepository;
        this.notificationService = notificationService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void processTransaction(UUID userId, BigDecimal amount, String type, String description,
            UUID transactionId) {
        log.info("Processing transaction {} for user {}", transactionId, userId);

        if (isRateLimited(userId)) {
            log.warn("Rate limit exceeded for user {}", userId);
            return;
        }

        List<AlertRule> activeRules = alertRuleRepository.findByUserIdAndIsActiveTrue(userId);
        checkHighAmountAlert(userId, amount, type, description, transactionId, activeRules);
    }

    private void checkHighAmountAlert(UUID userId, BigDecimal amount, String type,
            String description, UUID transactionId, List<AlertRule> rules) {
        if (!"DEBIT".equals(type)) {
            return;
        }

        BigDecimal threshold = rules.stream()
                .filter(r -> r.getRuleType() == AlertRule.RuleType.HIGH_AMOUNT)
                .findFirst()
                .map(AlertRule::getThresholdAmount)
                .orElse(highAmountThreshold);

        if (amount.abs().compareTo(threshold) > 0) {
            AlertHistory alert = createAlert(
                    userId,
                    null,
                    AlertHistory.AlertType.HIGH_AMOUNT,
                    AlertHistory.Severity.WARNING,
                    String.format("High transaction detected: $%.2f for '%s'", amount.abs(), description),
                    Map.of(
                            "transactionId", transactionId.toString(),
                            "amount", amount.toString(),
                            "threshold", threshold.toString()));

            notificationService.sendNotification(alert);
        }
    }

    private AlertHistory createAlert(
            UUID userId,
            UUID ruleId,
            AlertHistory.AlertType type,
            AlertHistory.Severity severity,
            String message,
            Map<String, Object> metadata) {

        AlertHistory alert = new AlertHistory();
        alert.setUserId(userId);
        alert.setRuleId(ruleId);
        alert.setAlertType(type);
        alert.setSeverity(severity);
        alert.setMessage(message);

        try {
            alert.setMetadata(objectMapper.writeValueAsString(metadata));
        } catch (Exception e) {
            log.error("Error serializing metadata to JSON", e);
            alert.setMetadata("{}");
        }

        alert.setIsRead(false);

        AlertHistory saved = alertHistoryRepository.save(alert);
        log.info("Created alert {} for user {}", saved.getId(), userId);

        incrementRateLimitCounter(userId);

        return saved;
    }

    private boolean isRateLimited(UUID userId) {
        if (redisTemplate == null) {
            log.debug("Redis unavailable - skipping rate limit check for user {}", userId);
            return false;
        }
        try {
            String key = "alert:ratelimit:" + userId;
            String count = redisTemplate.opsForValue().get(key);
            return count != null && Integer.parseInt(count) >= maxAlertsPerWindow;
        } catch (Exception e) {
            log.warn("Redis error during rate limit check, skipping: {}", e.getMessage());
            return false;
        }
    }

    private void incrementRateLimitCounter(UUID userId) {
        if (redisTemplate == null) {
            log.debug("Redis unavailable - skipping rate limit increment for user {}", userId);
            return;
        }
        try {
            String key = "alert:ratelimit:" + userId;
            Long newCount = redisTemplate.opsForValue().increment(key);
            if (newCount != null && newCount == 1) {
                redisTemplate.expire(key, rateLimitWindow, TimeUnit.SECONDS);
            }
        } catch (Exception e) {
            log.warn("Redis error during rate limit increment, skipping: {}", e.getMessage());
        }
    }
}