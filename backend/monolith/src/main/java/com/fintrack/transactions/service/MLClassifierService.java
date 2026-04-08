package com.fintrack.transactions.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;

import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class MLClassifierService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${ml-classifier.url}")
    private String mlClassifierUrl;

    /**
     * Predict category for a transaction.
     * Returns a map with "category" and "confidence" keys.
     * Falls back to UNCATEGORIZED with confidence 0.0 when the ML service is unavailable.
     */
    public Map<String, Object> predictCategory(String description, Double amount) {
        try {
            String url = mlClassifierUrl + "/predict";

            Map<String, Object> request = new HashMap<>();
            request.put("description", description);
            request.put("amount", amount);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode jsonNode = objectMapper.readTree(response.getBody());
                String category = jsonNode.get("category").asText();
                double confidence = jsonNode.get("confidence").asDouble();

                log.debug("ML Prediction: {} (confidence: {}) for: {}", category, confidence, description);

                if (confidence > 0.5) {
                    return Map.of("category", category, "confidence", confidence);
                }
            }
        } catch (Exception e) {
            log.debug("ML classifier unavailable, falling back to UNCATEGORIZED: {}", e.getMessage());
        }
        return Map.of("category", "UNCATEGORIZED", "confidence", 0.0);
    }

    /**
     * Send feedback to ML model for training
     */
    public void sendFeedback(String description, Double amount, String actualCategory, String predictedCategory) {
        try {
            String url = mlClassifierUrl + "/feedback";

            Map<String, Object> feedback = new HashMap<>();
            feedback.put("description", description);
            feedback.put("amount", amount);
            feedback.put("actual_category", actualCategory);
            feedback.put("predicted_category", predictedCategory);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(feedback, headers);

            restTemplate.postForEntity(url, entity, String.class);

            log.info("Feedback sent to ML model: {} -> {}", predictedCategory, actualCategory);
        } catch (Exception e) {
            log.error("Error sending feedback to ML classifier", e);
        }
    }

    /**
     * Train the ML model with user's transaction history
     */
    public void trainModel(Long userId) {
        try {
            String url = mlClassifierUrl + "/train";

            Map<String, Object> request = new HashMap<>();
            request.put("user_id", userId);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            restTemplate.postForEntity(url, entity, String.class);

            log.info("Model training triggered for user: {}", userId);
        } catch (Exception e) {
            log.error("Error triggering model training", e);
        }
    }

    /**
     * Get model accuracy metrics
     */
    public Map<String, Object> getModelMetrics() {
        try {
            String url = mlClassifierUrl + "/metrics";

            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return objectMapper.readValue(response.getBody(), Map.class);
            }
        } catch (Exception e) {
            log.error("Error fetching model metrics", e);
        }
        return new HashMap<>();
    }
}
