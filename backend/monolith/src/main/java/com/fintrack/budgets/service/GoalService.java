package com.fintrack.budgets.service;

import com.fintrack.budgets.dto.GoalDTO;
import com.fintrack.budgets.entity.Goal;
import com.fintrack.budgets.exception.ResourceNotFoundException;
import com.fintrack.budgets.repository.GoalRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class GoalService {

    private final GoalRepository goalRepository;

    public List<GoalDTO> getAllGoalsByUserId(String userId) {
        log.info("Fetching all goals for user: {}", userId);
        List<Goal> goals = goalRepository.findByUserId(userId);
        return goals.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    public GoalDTO getGoalById(String id, String userId) {
        log.info("Fetching goal {} for user {}", id, userId);
        Goal goal = goalRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Goal not found"));
        return convertToDTO(goal);
    }

    @Transactional
    public GoalDTO createGoal(GoalDTO goalDTO) {
        log.info("Creating goal: {}", goalDTO.getName());

        Goal goal = Goal.builder()
                .userId(goalDTO.getUserId())
                .name(goalDTO.getName())
                .targetAmount(goalDTO.getTargetAmount())
                .currentAmount(goalDTO.getCurrentAmount() != null ? goalDTO.getCurrentAmount() : BigDecimal.ZERO)
                .deadline(goalDTO.getDeadline())
                .category(goalDTO.getCategory())
                .icon(goalDTO.getIcon() != null ? goalDTO.getIcon() : "🎯")
                .color(goalDTO.getColor() != null ? goalDTO.getColor() : "#10b981")
                .monthlyContribution(
                        goalDTO.getMonthlyContribution() != null ? goalDTO.getMonthlyContribution() : BigDecimal.ZERO)
                .build();

        Goal savedGoal = goalRepository.save(goal);
        return convertToDTO(savedGoal);
    }

    @Transactional
    public GoalDTO updateGoal(String id, GoalDTO goalDTO, String userId) {
        log.info("Updating goal {}", id);
        Goal goal = goalRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Goal not found"));

        if (goalDTO.getName() != null) {
            goal.setName(goalDTO.getName());
        }
        if (goalDTO.getTargetAmount() != null) {
            goal.setTargetAmount(goalDTO.getTargetAmount());
        }
        if (goalDTO.getCurrentAmount() != null) {
            goal.setCurrentAmount(goalDTO.getCurrentAmount());
        }
        if (goalDTO.getDeadline() != null) {
            goal.setDeadline(goalDTO.getDeadline());
        }
        if (goalDTO.getCategory() != null) {
            goal.setCategory(goalDTO.getCategory());
        }
        if (goalDTO.getIcon() != null) {
            goal.setIcon(goalDTO.getIcon());
        }
        if (goalDTO.getColor() != null) {
            goal.setColor(goalDTO.getColor());
        }
        if (goalDTO.getMonthlyContribution() != null) {
            goal.setMonthlyContribution(goalDTO.getMonthlyContribution());
        }

        Goal updatedGoal = goalRepository.save(goal);
        return convertToDTO(updatedGoal);
    }

    @Transactional
    public GoalDTO contributeToGoal(String id, BigDecimal amount, String userId) {
        log.info("Contributing {} to goal {}", amount, id);
        Goal goal = goalRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Goal not found"));

        goal.setCurrentAmount(goal.getCurrentAmount().add(amount));

        // Check if goal is achieved
        if (goal.isGoalAchieved()) {
            goal.setAchieved(true);
        }

        Goal updatedGoal = goalRepository.save(goal);
        return convertToDTO(updatedGoal);
    }

    @Transactional
    public void deleteGoal(String id, String userId) {
        log.info("Deleting goal {}", id);
        Goal goal = goalRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Goal not found"));
        goalRepository.delete(goal);
    }

    @Transactional
    public void deleteAllGoalsByUserId(String userId) {
        goalRepository.deleteAllByUserId(userId);
        log.info("All goals deleted for userId={}", userId);
    }

    public Map<String, Object> getGoalsSummary(String userId) {
        List<Goal> goals = goalRepository.findByUserId(userId);

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalGoals", goals.size());
        summary.put("achievedGoals", goals.stream().filter(Goal::getAchieved).count());
        summary.put("totalTarget", goals.stream()
                .map(Goal::getTargetAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        summary.put("totalSaved", goals.stream()
                .map(Goal::getCurrentAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add));

        return summary;
    }

    private GoalDTO convertToDTO(Goal goal) {
        return GoalDTO.builder()
                .id(goal.getId())
                .userId(goal.getUserId())
                .name(goal.getName())
                .targetAmount(goal.getTargetAmount())
                .currentAmount(goal.getCurrentAmount())
                .deadline(goal.getDeadline())
                .category(goal.getCategory())
                .icon(goal.getIcon())
                .color(goal.getColor())
                .monthlyContribution(goal.getMonthlyContribution())
                .progress(goal.getProgress())
                .achieved(goal.getAchieved())
                .build();
    }
}
