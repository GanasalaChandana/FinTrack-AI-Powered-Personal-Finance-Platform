package com.fintrack.auth.service;

import com.fintrack.auth.entity.PasswordResetToken;
import com.fintrack.auth.entity.User;
import com.fintrack.auth.repository.PasswordResetTokenRepository;
import com.fintrack.auth.repository.UserRepository;
import com.fintrack.auth.security.TokenRevocationService;
import com.fintrack.common.EmailService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

/**
 * "Forgot password": emails a single-use link valid for 30 minutes. The reply to a
 * request is the same whether or not the address has an account, so the endpoint
 * can't be used to find out who is registered.
 */
@Service
@Slf4j
public class PasswordResetService {

    static final Duration TOKEN_TTL = Duration.ofMinutes(30);
    public static final int MIN_PASSWORD_LENGTH = 8;
    public static final int MAX_PASSWORD_LENGTH = 128;

    private final UserRepository users;
    private final PasswordResetTokenRepository tokens;
    private final PasswordEncoder passwordEncoder;
    private final TokenRevocationService revocation;
    private final EmailService email;
    private final String appBaseUrl;
    private final SecureRandom random = new SecureRandom();

    public PasswordResetService(UserRepository users, PasswordResetTokenRepository tokens,
                                PasswordEncoder passwordEncoder, TokenRevocationService revocation,
                                EmailService email,
                                @Value("${app.base-url:https://fintrack-liart.vercel.app}") String appBaseUrl) {
        this.users = users;
        this.tokens = tokens;
        this.passwordEncoder = passwordEncoder;
        this.revocation = revocation;
        this.email = email;
        this.appBaseUrl = appBaseUrl.replaceAll("/+$", "");
    }

    /** Sends a reset link if the address has an account (other than the shared demo). */
    @Transactional
    public void requestReset(String rawEmail) {
        if (rawEmail == null || rawEmail.isBlank()) return;
        Optional<User> found = users.findByEmailIgnoreCase(rawEmail.trim());
        if (found.isEmpty() || DemoService.DEMO_EMAIL.equalsIgnoreCase(found.get().getEmail())) {
            log.info("Password reset requested for an address without an account");
            return;
        }
        User user = found.get();
        tokens.invalidateAllForUser(user.getId()); // only the newest link works

        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        PasswordResetToken t = new PasswordResetToken();
        t.setUser(user);
        t.setTokenHash(sha256(token));
        t.setCreatedAt(LocalDateTime.now());
        t.setExpiresAt(LocalDateTime.now().plus(TOKEN_TTL));
        tokens.save(t);

        String link = appBaseUrl + "/reset-password?token=" + token;
        boolean sent = email.send(user.getEmail(), "Reset your FinTrack password", """
                Hi,

                Someone (hopefully you) asked to reset the password for your FinTrack account.
                Open this link within 30 minutes to choose a new password:

                %s

                If you didn't ask for this, ignore this email: your password stays the same.

                FinTrack
                """.formatted(link));
        if (!sent) log.warn("Password reset link for user {} was not emailed (email not configured)", user.getId());
    }

    /**
     * Sets the new password if the token is valid, unused and not expired, and signs
     * the account out everywhere. Returns false for a bad or expired link.
     */
    @Transactional
    public boolean resetPassword(String token, String newPassword) {
        if (token == null || token.isBlank()) return false;
        if (newPassword == null || newPassword.length() < MIN_PASSWORD_LENGTH || newPassword.length() > MAX_PASSWORD_LENGTH) {
            throw new IllegalArgumentException("Password must be " + MIN_PASSWORD_LENGTH + " to " + MAX_PASSWORD_LENGTH + " characters");
        }
        Optional<PasswordResetToken> found = tokens.findByTokenHash(sha256(token));
        if (found.isEmpty()) return false;
        PasswordResetToken t = found.get();
        if (t.isUsed() || t.getExpiresAt().isBefore(LocalDateTime.now())) return false;

        User user = t.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        users.save(user);
        tokens.invalidateAllForUser(user.getId());
        revocation.revokeAll(user.getId()); // whoever had the old password is signed out
        log.info("Password reset completed for user {}", user.getId());
        return true;
    }

    static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
