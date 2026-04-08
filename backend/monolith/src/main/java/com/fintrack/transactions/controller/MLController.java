package com.fintrack.transactions.controller;

import com.fintrack.transactions.service.MLClassifierService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.HashMap;

@Slf4j
@RestController
@RequestMapping("/api/ml")
@RequiredArgsConstructor
public class MLController {

    private final MLClassifierService mlClassifierService;

    @PostMapping("/predict")
    public ResponseEntity<?> predict(@RequestBody Map<String, Object> request) {
        try {
            String description = (String) request.get("description");
            if (description == null || description.isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "description is required"));
            }

            Object amountRaw = request.get("amount");
            double amount = 0.0;
            if (amountRaw instanceof Number) {
                amount = ((Number) amountRaw).doubleValue();
            }

            Map<String, Object> result = mlClassifierService.predictCategory(description, amount);
            return ResponseEntity.ok(result);
        } catch (ClassCastException e) {
            log.warn("ML predict - invalid request body: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid request body: " + e.getMessage()));
        } catch (Exception e) {
            log.error("ML predict failed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Prediction failed"));
        }
    }

    @GetMapping("/metrics")
    public ResponseEntity<?> getMetrics() {
        try {
            return ResponseEntity.ok(mlClassifierService.getModelMetrics());
        } catch (Exception e) {
            log.error("Error fetching ML metrics: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to retrieve metrics"));
        }
    }
}
