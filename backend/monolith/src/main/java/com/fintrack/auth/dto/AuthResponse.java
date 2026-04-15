package com.fintrack.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {

    private String token;

    /** Opaque refresh token — use POST /api/auth/refresh to rotate. */
    private String refreshToken;

    /** ISO-8601 expiry of the refresh token (30 days from issue). */
    private String refreshTokenExpiry;

    private UserDto user;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserDto {
        private UUID id; // IMPORTANT: Must be UUID, not Long!
        private String email;
        private String username;
        private String firstName;
        private String lastName;
        private String role;
        private String profilePicture;
    }
}
