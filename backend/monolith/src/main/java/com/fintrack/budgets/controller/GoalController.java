package com.fintrack.budgets.controller;

import com.fintrack.budgets.dto.GoalDTO;
import com.fintrack.budgets.service.GoalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/goals")
@RequiredArgsConstructor
@Slf4j
public class GoalController {

    private final GoalService goalService;

    @GetMapping
    public ResponseEntity<List<GoalDTO>> getAllGoals(
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        List<GoalDTO> goals = goalService.getAllGoalsByUserId(userId);
        return ResponseEntity.ok(goals);
    }

    @GetMapping("/{id}")
    public ResponseEntity<GoalDTO> getGoalById(
            @PathVariable String id,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        GoalDTO goal = goalService.getGoalById(id, userId);
        return ResponseEntity.ok(goal);
    }

    @PostMapping
    public ResponseEntity<GoalDTO> createGoal(
            @Valid @RequestBody GoalDTO goalDTO,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        goalDTO.setUserId(userId); // Now works with String
        GoalDTO createdGoal = goalService.createGoal(goalDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdGoal);
    }

    @PutMapping("/{id}")
    public ResponseEntity<GoalDTO> updateGoal(
            @PathVariable String id,
            @Valid @RequestBody GoalDTO goalDTO,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        GoalDTO updatedGoal = goalService.updateGoal(id, goalDTO, userId);
        return ResponseEntity.ok(updatedGoal);
    }

    @PatchMapping("/{id}/contribute")
    public ResponseEntity<GoalDTO> contributeToGoal(
            @PathVariable String id,
            @RequestBody Map<String, BigDecimal> payload,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        BigDecimal amount = payload.get("amount");
        if (amount == null) {
            log.warn("PATCH /api/goals/{}/contribute rejected: missing amount", id);
            return ResponseEntity.badRequest().build();
        }
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("PATCH /api/goals/{}/contribute rejected: amount {} must be positive", id, amount);
            return ResponseEntity.badRequest().build();
        }

        GoalDTO updatedGoal = goalService.contributeToGoal(id, amount, userId);
        return ResponseEntity.ok(updatedGoal);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteGoal(
            @PathVariable String id,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        goalService.deleteGoal(id, userId);
        return ResponseEntity.ok(Map.of("message", "Goal deleted successfully"));
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getGoalsSummary(
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Map<String, Object> summary = goalService.getGoalsSummary(userId);
        return ResponseEntity.ok(summary);
    }
}
