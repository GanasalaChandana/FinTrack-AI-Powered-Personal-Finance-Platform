package com.fintrack.auth.controller;

import com.fintrack.auth.entity.User;
import com.fintrack.auth.security.JwtUtil;
import com.fintrack.auth.service.DemoService;
import com.fintrack.auth.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Slf4j
public class UsersController {

    private final UserService userService;
    private final DemoService demoService;
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
        if (authentication == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Optional<User> user = userService.findByEmail(authentication.getName());
        if (user.isEmpty()) {
            log.warn("GET /api/users/me - user not found for email={}", authentication.getName());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.ok(user.get());
    }

    @GetMapping("/profile")
    public ResponseEntity<User> getUserProfile(Authentication authentication) {
        return getCurrentUser(authentication);
    }

    @GetMapping("/{userId}")
    public ResponseEntity<User> getUserById(
            @PathVariable String userId,
            Authentication authentication) {

        if (authentication == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        Optional<User> currentUserOpt = userService.findByEmail(authentication.getName());
        if (currentUserOpt.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        User currentUser = currentUserOpt.get();
        if (!currentUser.getId().equals(userId) && !"ADMIN".equals(currentUser.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Optional<User> target = userService.findById(userId);
        if (target.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        return ResponseEntity.ok(target.get());
    }

    @PutMapping("/profile")
    public ResponseEntity<User> updateProfile(
            @RequestBody UpdateProfileRequest request,
            Authentication authentication) {

        if (authentication == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Optional<User> userOpt = userService.findByEmail(authentication.getName());
        if (userOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();

        User user = userOpt.get();
        if (request.getFirstName() != null) user.setFirstName(request.getFirstName());
        if (request.getLastName()  != null) user.setLastName(request.getLastName());
        if (request.getName()      != null) user.setName(request.getName());
        if (request.getFirstName() != null || request.getLastName() != null) {
            String full = ((user.getFirstName() != null ? user.getFirstName() : "") + " " +
                          (user.getLastName()   != null ? user.getLastName()  : "")).trim();
            if (!full.isEmpty()) user.setName(full);
        }
        return ResponseEntity.ok(userService.save(user));
    }

    @DeleteMapping("/me")
    public ResponseEntity<Map<String, String>> deleteAccount(Authentication authentication) {
        if (authentication == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Optional<User> userOpt = userService.findByEmail(authentication.getName());
        if (userOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();

        userService.deleteById(userOpt.get().getId());
        return ResponseEntity.ok(Map.of("message", "Account deleted successfully"));
    }

    /**
     * Reset the authenticated user's transactions, budgets, and goals
     * to the standard demo dataset. Useful for portfolio demos.
     */
    @PostMapping("/reset-data")
    public ResponseEntity<Map<String, String>> resetData(Authentication authentication) {
        if (authentication == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Optional<User> userOpt = userService.findByEmail(authentication.getName());
        if (userOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();

        demoService.resetDataForUser(userOpt.get().getId().toString());
        return ResponseEntity.ok(Map.of("message", "Data reset to demo dataset successfully"));
    }

    @PostMapping("/change-password")
    public ResponseEntity<Map<String, String>> changePassword(
            @RequestBody ChangePasswordRequest request,
            Authentication authentication) {

        if (authentication == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Optional<User> userOpt = userService.findByEmail(authentication.getName());
        if (userOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();

        User user = userOpt.get();
        if (!userService.checkPassword(user, request.getCurrentPassword())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Current password is incorrect"));
        }
        userService.updatePassword(user, request.getNewPassword());
        return ResponseEntity.ok(Map.of("message", "Password changed successfully"));
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
