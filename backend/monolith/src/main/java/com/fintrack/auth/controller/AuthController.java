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
@CrossOrigin(origins = {
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://127.0.0.1:3000",
        "https://fintrack-liart.vercel.app"
}, allowCredentials = "true", maxAge = 3600)
public class AuthController {

    private final AuthService authService;
    private final GoogleAuthService googleAuthService;
    private final DemoService demoService;
    private final LoginRateLimiter rateLimiter;

    // ── POST /api/auth/register ───────────────────────────────────────────────

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request,
                                      HttpServletRequest httpRequest) {
        String ip = resolveClientIp(httpRequest);

        if (!rateLimiter.tryConsume(ip)) {
            long retryAfter = rateLimiter.retryAfterSeconds(ip);
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
            rateLimiter.reset(ip); // successful registration — clear counter
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

        if (!rateLimiter.tryConsume(ip)) {
            long retryAfter = rateLimiter.retryAfterSeconds(ip);
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
            rateLimiter.reset(ip); // successful login — reset counter for this IP
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
                    .body(Map.of("error", e.getMessage(), "message", "Google authentication failed. Please try again."));
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
                    .body(Map.of("error", "Demo login failed", "message", e.getMessage()));
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
     * Resolves the real client IP, respecting X-Forwarded-For from a reverse proxy
     * (Vercel, Render, Cloudflare, AWS ALB all set this header).
     */
    private String resolveClientIp(HttpServletRequest request) {
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
