package com.fintrack.auth.service;

import java.util.Locale;
import com.fintrack.auth.dto.AuthResponse;
import com.fintrack.auth.dto.LoginRequest;
import com.fintrack.auth.dto.RegisterRequest;
import com.fintrack.auth.entity.RefreshToken;
import com.fintrack.auth.entity.User;
import com.fintrack.auth.enums.Role;
import com.fintrack.auth.repository.RefreshTokenRepository;
import com.fintrack.auth.repository.UserRepository;
import com.fintrack.auth.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private static final int    REFRESH_TOKEN_BYTES   = 32;          // 256-bit raw token
    private static final long   REFRESH_TOKEN_DAYS    = 30;          // 30-day validity
    private static final SecureRandom SECURE_RANDOM   = new SecureRandom();

    private final UserRepository         userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder        passwordEncoder;
    private final JwtUtil                jwtUtil;
    private final DemoService            demoService;
    private final com.fintrack.auth.twofactor.TwoFactorService twoFactorService;
    private final com.fintrack.auth.twofactor.TwoFactorRecoveryService twoFactorRecovery;

    // ── register ──────────────────────────────────────────────────────────────

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new RuntimeException("Email already registered");
        }

        User user = User.builder()
                .email(email)
                .username(userRepository.uniqueUsername(request.getUsername(), email))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(Role.USER)
                .build();

        User saved = userRepository.save(user);
        log.info("New user registered: {}", saved.getEmail());

        // Seed demo data so the dashboard is populated on first login
        demoService.seedDemoData(saved.getId().toString());

        return buildAuthResponse(saved);
    }

    // ── login ─────────────────────────────────────────────────────────────────

    @Transactional
    public AuthResponse login(LoginRequest request) {
        // Case-insensitive so "John@x.com" can log in to "john@x.com" (older
        // accounts may have been stored with their original capitalisation)
        String email = request.getEmail() == null ? "" : request.getEmail().trim();
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Invalid credentials");
        }
        if (user.isTotpEnabled() && twoFactorRecovery.isDue(user)) {
            twoFactorRecovery.complete(user); // the waiting period after "lost my authenticator" is over
            log.info("Two-factor turned off for {} after the recovery waiting period", user.getEmail());
        } else if (user.isTotpEnabled()) {
            String code = request.getTwoFactorCode();
            if (code == null || code.isBlank()) throw new com.fintrack.auth.twofactor.TwoFactorRequiredException();
            if (!twoFactorService.verify(user, code)) throw new com.fintrack.auth.twofactor.InvalidTwoFactorCodeException();
            if (user.getTotpRecoveryAt() != null) { // they still have their authenticator: cancel the recovery
                user.setTotpRecoveryAt(null);
                user.setTotpRecoveryCancelHash(null);
                userRepository.save(user);
            }
        }

        log.info("User logged in: {}", user.getEmail());
        return buildAuthResponse(user);
    }

    /** The user, if the email and password are right (no session is issued). */
    public java.util.Optional<User> checkPassword(String email, String password) {
        if (email == null || password == null) return java.util.Optional.empty();
        return userRepository.findByEmailIgnoreCase(email.trim())
                .filter(u -> u.getPasswordHash() != null && passwordEncoder.matches(password, u.getPasswordHash()));
    }

    // ── refresh ───────────────────────────────────────────────────────────────

    /**
     * Rotates a refresh token:
     * 1. Look up the stored token by its SHA-256 hash
     * 2. Reject if expired or already used (replay attack)
     * 3. Mark it used
     * 4. Issue a new access token + new refresh token
     */
    @Transactional
    public AuthResponse refreshAccessToken(String rawRefreshToken) {
        String hash = sha256Hex(rawRefreshToken);

        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new RuntimeException("Invalid refresh token"));

        if (stored.isUsed()) {
            // Possible replay — revoke all tokens for this user as a precaution
            refreshTokenRepository.deleteAllByUserId(stored.getUser().getId());
            log.warn("Replay attack detected for user {} — all refresh tokens revoked",
                    stored.getUser().getEmail());
            throw new RuntimeException("Refresh token already used");
        }

        if (stored.isExpired()) {
            throw new RuntimeException("Refresh token expired");
        }

        // Rotate: mark old token used
        stored.setUsed(true);
        refreshTokenRepository.save(stored);

        log.info("Refresh token rotated for user: {}", stored.getUser().getEmail());
        return buildAuthResponse(stored.getUser());
    }

    // ── getCurrentUser ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public User getCurrentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    // ── housekeeping ──────────────────────────────────────────────────────────

    /** Remove expired refresh tokens daily at 03:00. */
    @Scheduled(cron = "0 0 3 * * *")
    @SchedulerLock(name = "refreshTokenCleanup", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    @Transactional
    public void purgeExpiredRefreshTokens() {
        refreshTokenRepository.deleteExpiredBefore(LocalDateTime.now());
        log.info("Purged expired refresh tokens");
    }

    // ── private helpers ───────────────────────────────────────────────────────

    /** A fresh access + refresh token pair for the user (e.g. after a password change). */
    @Transactional
    public AuthResponse issueTokens(User user) {
        return buildAuthResponse(user);
    }

    private AuthResponse buildAuthResponse(User user) {
        String accessToken   = jwtUtil.generateToken(user);
        String rawRefresh    = generateRawRefreshToken();
        String hash          = sha256Hex(rawRefresh);
        LocalDateTime expiry = LocalDateTime.now().plusDays(REFRESH_TOKEN_DAYS);

        RefreshToken rt = RefreshToken.builder()
                .user(user)
                .tokenHash(hash)
                .expiresAt(expiry)
                .build();
        refreshTokenRepository.save(rt);

        AuthResponse.UserDto userDto = AuthResponse.UserDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .username(user.getUsername())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .role(user.getRole().toString())
                .profilePicture(user.getProfilePicture())
                .build();

        return AuthResponse.builder()
                .token(accessToken)
                .refreshToken(rawRefresh)
                .refreshTokenExpiry(expiry.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
                .user(userDto)
                .build();
    }

    private static String generateRawRefreshToken() {
        byte[] bytes = new byte[REFRESH_TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 unavailable", e);
        }
    }
}
