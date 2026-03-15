package com.fintrack.alerts.service;

import com.fintrack.alerts.dto.TransactionEvent;
import com.fintrack.alerts.entity.AlertHistory;
import com.fintrack.alerts.entity.AlertRule;
import com.fintrack.alerts.repository.AlertHistoryRepository;
import com.fintrack.alerts.repository.AlertRuleRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class AlertProcessingService {

    private final AlertRuleRepository alertRuleRepository;
    private final AlertHistoryRepository alertHistoryRepository;
    private final AlertNotificationService AlertNotificationService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Value("${alert.rules.high-amount-threshold}")
    private BigDecimal highAmountThreshold;

    @Value("${alert.rules.rate-limit-window-seconds}")
    private int rateLimitWindow;

    @Value("${alert.rules.max-alerts-per-window}")
    private int maxAlertsPerWindow;

    @Transactional
    public void processTransaction(TransactionEvent transaction) {
        log.info("Processing transaction {} for user {}", transaction.getId(), transaction.getUserId());

        // Check rate limiting
        if (isRateLimited(transaction.getUserId())) {
            log.warn("Rate limit exceeded for user {}", transaction.getUserId());
            return;
        }

        // Get active rules for user
        List<AlertRule> activeRules = alertRuleRepository
                .findByUserIdAndIsActiveTrue(transaction.getUserId());

        // Check high amount
        checkHighAmountAlert(transaction, activeRules);

        // Check daily limit
        checkDailyLimitAlert(transaction, activeRules);

        // Check unusual category
        checkUnusualCategoryAlert(transaction, activeRules);
    }

    private void checkHighAmountAlert(TransactionEvent transaction, List<AlertRule> rules) {
        if (!"DEBIT".equals(transaction.getType())) {
            return; // Only alert on debits
        }

        BigDecimal threshold = rules.stream()
                .filter(r -> r.getRuleType() == AlertRule.RuleType.HIGH_AMOUNT)
                .findFirst()
                .map(AlertRule::getThresholdAmount)
                .orElse(highAmountThreshold);

        if (transaction.getAmount().abs().compareTo(threshold) > 0) {
            AlertHistory alert = createAlert(
                    transaction.getUserId(),
                    null,
                    AlertHistory.AlertType.HIGH_AMOUNT,
                    AlertHistory.Severity.WARNING,
                    String.format("High transaction detected: $%.2f for '%s'",
                            transaction.getAmount().abs(), transaction.getDescription()),
                    Map.of(
                            "transactionId", transaction.getId().toString(),
                            "amount", transaction.getAmount().toString(),
                            "threshold", threshold.toString()));

            AlertNotificationService.sendNotification(alert);
        }
    }

    private void checkDailyLimitAlert(TransactionEvent transaction, List<AlertRule> rules) {
        // Implementation for daily spending limit check
        // Query sum of transactions for today and compare against limit
        log.debug("Checking daily limit for user {}", transaction.getUserId());
    }

    private void checkUnusualCategoryAlert(TransactionEvent transaction, List<AlertRule> rules) {
        // Implementation for unusual category detection
        // Could use ML predictions or historical patterns
        log.debug("Checking unusual category for transaction {}", transaction.getId());
    }

    private AlertHistory createAlert(
            java.util.UUID userId,
            java.util.UUID ruleId,
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

        // Convert Map to JSON string
        try {
            alert.setMetadata(objectMapper.writeValueAsString(metadata));
        } catch (Exception e) {
            log.error("Error serializing metadata to JSON", e);
            alert.setMetadata("{}");
        }

        alert.setIsRead(false);

        AlertHistory saved = alertHistoryRepository.save(alert);
        log.info("Created alert {} for user {}", saved.getId(), userId);

        // Increment rate limit counter
        incrementRateLimitCounter(userId);

        return saved;
    }

    private boolean isRateLimited(java.util.UUID userId) {
        String key = "alert:ratelimit:" + userId;
        String count = redisTemplate.opsForValue().get(key);
        return count != null && Integer.parseInt(count) >= maxAlertsPerWindow;
    }

    private void incrementRateLimitCounter(java.util.UUID userId) {
        String key = "alert:ratelimit:" + userId;
        Long newCount = redisTemplate.opsForValue().increment(key);
        if (newCount != null && newCount == 1) {
            redisTemplate.expire(key, rateLimitWindow, TimeUnit.SECONDS);
        }
    }
}
