package com.fintrack.auth.service;

import com.fintrack.auth.dto.AuthResponse;
import com.fintrack.auth.entity.User;
import com.fintrack.auth.enums.Role;
import com.fintrack.auth.repository.UserRepository;
import com.fintrack.auth.security.JwtUtil;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Collections;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class GoogleAuthService {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    @Value("${google.oauth.client-id}")
    private String googleClientId;

    /**
     * Authenticate user with Google credential token
     * If user doesn't exist, create a new account
     */
    @Transactional
    public AuthResponse authenticateWithGoogle(String credential) {
        try {
            log.info("🔐 Starting Google authentication");
            log.debug("Client ID: {}", googleClientId);
            log.debug("Credential length: {}", credential != null ? credential.length() : 0);

            if (credential == null || credential.isEmpty()) {
                log.error("❌ Credential is null or empty");
                throw new IllegalArgumentException("Google credential is required");
            }

            // Verify Google token
            log.info("🔍 Verifying Google token...");
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(),
                    new GsonFactory())
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken;
            try {
                idToken = verifier.verify(credential);
            } catch (GeneralSecurityException e) {
                log.error("❌ Security exception verifying Google token: {}", e.getMessage(), e);
                throw new IllegalArgumentException("Invalid Google token - security error: " + e.getMessage());
            } catch (IOException e) {
                log.error("❌ IO exception verifying Google token: {}", e.getMessage(), e);
                throw new RuntimeException("Failed to verify Google token - network error: " + e.getMessage());
            }

            if (idToken == null) {
                log.error("❌ Invalid Google token - verification returned null");
                throw new IllegalArgumentException("Invalid Google token - verification failed");
            }

            log.info("✅ Google token verified successfully");

            // Extract user information from token
            GoogleIdToken.Payload payload = idToken.getPayload();
            String email = payload.getEmail();
            String googleId = payload.getSubject();
            String name = (String) payload.get("name");
            String givenName = (String) payload.get("given_name");
            String familyName = (String) payload.get("family_name");
            String pictureUrl = (String) payload.get("picture");
            boolean emailVerified = payload.getEmailVerified();

            log.info("📧 Email: {}", email);
            log.info("👤 Name: {}", name);
            log.info("✉️ Email verified: {}", emailVerified);

            if (!emailVerified) {
                log.warn("⚠️ Email not verified: {}", email);
                // You might want to handle unverified emails differently
            }

            // Find or create user
            log.info("🔍 Finding or creating user...");
            User user;
            try {
                user = findOrCreateUser(email, googleId, givenName, familyName, name, pictureUrl);
            } catch (Exception e) {
                log.error("❌ Failed to find or create user: {}", e.getMessage(), e);
                throw new RuntimeException("Failed to create user account: " + e.getMessage());
            }

            log.info("✅ User found/created: {}", user.getEmail());

            // Generate JWT token
            log.info("🔑 Generating JWT token...");
            String jwtToken;
            try {
                jwtToken = jwtUtil.generateToken(user);
            } catch (Exception e) {
                log.error("❌ Failed to generate JWT token: {}", e.getMessage(), e);
                throw new RuntimeException("Failed to generate authentication token: " + e.getMessage());
            }

            log.info("✅ JWT token generated successfully");

            // Build response
            AuthResponse.UserDto userDto = AuthResponse.UserDto.builder()
                    .id(user.getId())
                    .email(user.getEmail())
                    .username(user.getUsername())
                    .firstName(user.getFirstName())
                    .lastName(user.getLastName())
                    .role(user.getRole().toString())
                    .build();

            log.info("🎉 Google authentication successful for: {}", email);

            return AuthResponse.builder()
                    .token(jwtToken)
                    .user(userDto)
                    .build();

        } catch (IllegalArgumentException e) {
            log.error("❌ Validation error: {}", e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("❌ Unexpected error during Google authentication: {}", e.getMessage(), e);
            throw new RuntimeException("Authentication failed: " + e.getMessage());
        }
    }

    /**
     * Find existing user or create new user with Google account
     */
    private User findOrCreateUser(String email, String googleId, String givenName,
            String familyName, String fullName, String pictureUrl) {

        log.debug("🔍 Looking up user by email: {}", email);
        Optional<User> existingUser = userRepository.findByEmailIgnoreCase(email);

        if (existingUser.isPresent()) {
            User user = existingUser.get();
            log.info("✅ Found existing user: {}", email);

            // Update Google ID if not set
            if (user.getGoogleId() == null || user.getGoogleId().isEmpty()) {
                log.info("🔄 Updating Google ID for existing user: {}", email);
                user.setGoogleId(googleId);
                try {
                    userRepository.save(user);
                    log.info("✅ Google ID updated successfully");
                } catch (Exception e) {
                    log.error("❌ Failed to update Google ID: {}", e.getMessage(), e);
                    throw new RuntimeException("Failed to update user Google ID: " + e.getMessage());
                }
            }

            return user;
        }

        // Create new user using builder pattern
        log.info("➕ Creating new user for: {}", email);

        User newUser = User.builder()
                .email(email.trim().toLowerCase(java.util.Locale.ROOT))
                .googleId(googleId)
                .username(userRepository.uniqueUsername(null, email)) // email prefix, made unique
                .firstName(givenName != null ? givenName : fullName)
                .lastName(familyName)
                .name(fullName)
                .profilePicture(pictureUrl)
                .role(Role.USER)
                .passwordHash(null) // No password for OAuth users
                .build();

        try {
            User savedUser = userRepository.save(newUser);
            log.info("✅ New user created successfully: {}", email);
            return savedUser;
        } catch (Exception e) {
            log.error("❌ Failed to save new user: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to save new user: " + e.getMessage());
        }
    }
}
