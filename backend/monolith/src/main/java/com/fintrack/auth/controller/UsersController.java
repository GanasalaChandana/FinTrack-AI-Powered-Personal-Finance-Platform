package com.fintrack.auth.controller;

import com.fintrack.auth.entity.User;
import com.fintrack.auth.security.JwtUtil;
import com.fintrack.auth.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UsersController {

    private final UserService userService;
    private final JwtUtil jwtUtil;

    /**
     * Health check endpoint for users service
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "users-service");
        return ResponseEntity.ok(response);
    }

    /**
     * Get current user profile (requires authentication)
     */
    @GetMapping("/me")
    public ResponseEntity<User> getCurrentUser(Authentication authentication) {
        // Extract email from authentication principal
        String email = authentication.getName();
        User user = userService.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return ResponseEntity.ok(user);
    }

    /**
     * Get user profile by ID (requires authentication)
     */
    @GetMapping("/profile")
    public ResponseEntity<User> getUserProfile(Authentication authentication) {
        // Same as /me but with different endpoint name
        return getCurrentUser(authentication);
    }

    /**
     * Get user by ID (admin or self only)
     */
    @GetMapping("/{userId}")
    public ResponseEntity<User> getUserById(
            @PathVariable String userId,
            Authentication authentication) {

        String currentUserEmail = authentication.getName();
        User currentUser = userService.findByEmail(currentUserEmail)
                .orElseThrow(() -> new RuntimeException("Current user not found"));

        // Check if user is requesting their own profile or is admin
        if (!currentUser.getId().equals(userId) && !"ADMIN".equals(currentUser.getRole())) {
            return ResponseEntity.status(403).build(); // Forbidden
        }

        User user = userService.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return ResponseEntity.ok(user);
    }

    /**
     * Update user profile (self only)
     */
    @PutMapping("/profile")
    public ResponseEntity<User> updateProfile(
            @RequestBody UpdateProfileRequest request,
            Authentication authentication) {

        String email = authentication.getName();
        User user = userService.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (request.getFirstName() != null) user.setFirstName(request.getFirstName());
        if (request.getLastName() != null) user.setLastName(request.getLastName());
        if (request.getName() != null) user.setName(request.getName());
        // Keep name in sync with first+last
        if (request.getFirstName() != null || request.getLastName() != null) {
            String full = ((user.getFirstName() != null ? user.getFirstName() : "") + " " +
                          (user.getLastName()  != null ? user.getLastName()  : "")).trim();
            if (!full.isEmpty()) user.setName(full);
        }

        User updatedUser = userService.save(user);
        return ResponseEntity.ok(updatedUser);
    }

    /**
     * Delete user account (self only)
     */
    @DeleteMapping("/me")
    public ResponseEntity<Map<String, String>> deleteAccount(Authentication authentication) {
        String email = authentication.getName();
        User user = userService.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        userService.deleteById(user.getId());

        Map<String, String> response = new HashMap<>();
        response.put("message", "Account deleted successfully");
        return ResponseEntity.ok(response);
    }

    /**
     * Change password (self only)
     */
    @PostMapping("/change-password")
    public ResponseEntity<Map<String, String>> changePassword(
            @RequestBody ChangePasswordRequest request,
            Authentication authentication) {

        String email = authentication.getName();
        User user = userService.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!userService.checkPassword(user, request.getCurrentPassword())) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "Current password is incorrect");
            return ResponseEntity.status(400).body(err);
        }

        userService.updatePassword(user, request.getNewPassword());
        Map<String, String> response = new HashMap<>();
        response.put("message", "Password changed successfully");
        return ResponseEntity.ok(response);
    }

    // DTO for profile updates
    public static class UpdateProfileRequest {
        private String name;
        private String firstName;
        private String lastName;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getFirstName() { return firstName; }
        public void setFirstName(String firstName) { this.firstName = firstName; }
        public String getLastName() { return lastName; }
        public void setLastName(String lastName) { this.lastName = lastName; }
    }

    public static class ChangePasswordRequest {
        private String currentPassword;
        private String newPassword;

        public String getCurrentPassword() { return currentPassword; }
        public void setCurrentPassword(String currentPassword) { this.currentPassword = currentPassword; }
        public String getNewPassword() { return newPassword; }
        public void setNewPassword(String newPassword) { this.newPassword = newPassword; }
    }
}
