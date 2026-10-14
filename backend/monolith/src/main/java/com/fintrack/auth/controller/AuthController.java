package com.fintrack.auth.controller;

import com.fintrack.auth.dto.GoogleAuthRequest;
import com.fintrack.auth.dto.LoginRequest;
import com.fintrack.auth.dto.RegisterRequest;
import com.fintrack.auth.dto.AuthResponse;
import com.fintrack.auth.security.LoginRateLimiter;
import com.fintrack.auth.service.AuthService;
import com.fintrack.auth.service.DemoService;
import com.fintrack.auth.service.GoogleAuthService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final AuthService authService;
    private final GoogleAuthService googleAuthService;
    private final DemoService demoService;
    private final LoginRateLimiter rateLimiter;

    // Separate per-account limiter: the IP can be faked via X-Forwarded-For, the
    // target email can't. Kept apart from the IP table so flooding it with fake
    // IPs can't reset an account's counter.
    private final LoginRateLimiter emailRateLimiter = new LoginRateLimiter();

    // App-wide signup cap. The per-IP limit can be dodged with a fake
    // X-Forwarded-For, so this bounds scripted mass sign-ups regardless of IP.
    private static final String ALL_SIGNUPS = "all";
    private final LoginRateLimiter signupGlobalLimiter = new LoginRateLimiter(30, 10 * 60 * 1000L); // 30 per 10 min

    // ── POST /api/auth/register ───────────────────────────────────────────────

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request,
                                      HttpServletRequest httpRequest) {
        String ip = resolveClientIp(httpRequest);

        if (!rateLimiter.tryConsume(ip) || !signupGlobalLimiter.tryConsume(ALL_SIGNUPS)) {
            long retryAfter = Math.max(rateLimiter.retryAfterSeconds(ip),
                                       signupGlobalLimiter.retryAfterSeconds(ALL_SIGNUPS));
            log.warn("Rate limit: register blocked for IP {} (retry after {}s)", ip, retryAfter);
            return ResponseEntity
                    .status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(retryAfter))
                    .body(Map.of(
                            "error",   "Too many requests",
                            "message", "Too many attempts. Please try again in " + retryAfter + " seconds."));
        }

        try {
            log.info("Registration attempt from IP {} for email: {}", ip, request.getEmail());
            AuthResponse response = authService.register(request);
            // No reset on success: resetting let one IP create unlimited accounts
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Registration failed for {}: {}", request.getEmail(), e.getMessage());
            if (e.getMessage() != null && e.getMessage().contains("already registered")) {
                return ResponseEntity
                        .status(HttpStatus.CONFLICT)
                        .body(Map.of("error", "Registration failed",
                                     "message", "Unable to create account. Please check your details and try again."));
            }
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Registration failed",
                                 "message", "Unable to create account. Please check your details and try again."));
        }
    }

    // ── POST /api/auth/login ──────────────────────────────────────────────────

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request,
                                   HttpServletRequest httpRequest) {
        String ip = resolveClientIp(httpRequest);
        String emailKey = request.getEmail() != null ? request.getEmail().trim().toLowerCase() : "";

        if (!rateLimiter.tryConsume(ip) || !emailRateLimiter.tryConsume(emailKey)) {
            long retryAfter = Math.max(rateLimiter.retryAfterSeconds(ip),
                                       emailRateLimiter.retryAfterSeconds(emailKey));
            log.warn("Rate limit: login blocked for IP {} (retry after {}s)", ip, retryAfter);
            return ResponseEntity
                    .status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(retryAfter))
                    .body(Map.of(
                            "error",   "Too many requests",
                            "message", "Too many failed attempts. Please try again in " + retryAfter + " seconds."));
        }

        try {
            log.info("Login attempt from IP {} for email: {}", ip, request.getEmail());
            AuthResponse response = authService.login(request);
            rateLimiter.reset(ip); // successful login — reset counters for this IP and account
            emailRateLimiter.reset(emailKey);
            log.info("Login successful for: {}", request.getEmail());
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.warn("Login failed from IP {} for {}: {}", ip, request.getEmail(), e.getMessage());
            // Note: do NOT reset on failure — the failed attempt was already consumed above
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Login failed", "message", "Invalid email or password."));
        }
    }

    // ── POST /api/auth/refresh ────────────────────────────────────────────────

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody Map<String, String> body,
                                     HttpServletRequest httpRequest) {
        String ip = resolveClientIp(httpRequest);

        if (!rateLimiter.tryConsume(ip)) {
            long retryAfter = rateLimiter.retryAfterSeconds(ip);
            return ResponseEntity
                    .status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(retryAfter))
                    .body(Map.of("error", "Too many requests",
                                 "message", "Please try again in " + retryAfter + " seconds."));
        }

        String refreshToken = body.get("refreshToken");
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Bad request", "message", "refreshToken is required."));
        }

        try {
            AuthResponse response = authService.refreshAccessToken(refreshToken);
            rateLimiter.reset(ip);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.warn("Token refresh failed from IP {}: {}", ip, e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid token", "message", "Refresh token is invalid or expired."));
        }
    }

    // ── POST /api/auth/google ─────────────────────────────────────────────────

    @PostMapping("/google")
    public ResponseEntity<?> googleAuth(@RequestBody GoogleAuthRequest request,
                                        HttpServletRequest httpRequest) {
        String ip = resolveClientIp(httpRequest);

        if (!rateLimiter.tryConsume(ip)) {
            long retryAfter = rateLimiter.retryAfterSeconds(ip);
            return ResponseEntity
                    .status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(retryAfter))
                    .body(Map.of("error", "Too many requests",
                                 "message", "Please try again in " + retryAfter + " seconds."));
        }

        if (request.getCredential() == null || request.getCredential().isEmpty()) {
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Missing credential", "message", "Google credential is required."));
        }

        try {
            log.info("Google auth attempt from IP {}", ip);
            AuthResponse response = googleAuthService.authenticateWithGoogle(request.getCredential());
            rateLimiter.reset(ip);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage(), "message", "Invalid Google credential."));
        } catch (Exception e) {
            log.error("Google auth failed from IP {}: {}", ip, e.getMessage(), e);
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Google authentication failed", "message", "Google authentication failed. Please try again."));
        }
    }

    // ── POST /api/auth/demo ───────────────────────────────────────────────────

    @PostMapping("/demo")
    public ResponseEntity<?> demoLogin() {
        try {
            log.info("Demo login requested");
            AuthResponse response = demoService.loginAsDemo();
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Demo login failed: {}", e.getMessage(), e);
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Demo login failed", "message", "Demo is unavailable right now. Please try again."));
        }
    }

    // ── GET /api/auth/health ──────────────────────────────────────────────────

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of(
                "status",    "UP",
                "service",   "auth-service",
                "timestamp", System.currentTimeMillis()));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Resolves the client IP for rate limiting. CF-Connecting-IP is set by
     * Cloudflare (in front of Render) and overwritten on every request, so it
     * can't be spoofed by the client. X-Forwarded-For is only a fallback — its
     * leftmost entry is client-controlled, which is why login also has a
     * per-account limit.
     */
    private String resolveClientIp(HttpServletRequest request) {
        String cfIp = request.getHeader("CF-Connecting-IP");
        if (cfIp != null && !cfIp.isBlank()) {
            return cfIp.trim();
        }
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim(); // leftmost = original client
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }
}
