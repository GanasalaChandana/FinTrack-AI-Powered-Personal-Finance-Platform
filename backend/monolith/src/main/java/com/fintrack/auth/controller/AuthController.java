package com.fintrack.auth.controller;

import com.fintrack.auth.dto.GoogleAuthRequest;
import com.fintrack.auth.dto.LoginRequest;
import com.fintrack.auth.dto.RegisterRequest;
import com.fintrack.auth.dto.AuthResponse;
import com.fintrack.auth.security.JwtUtil;
import com.fintrack.auth.security.LoginRateLimiter;
import com.fintrack.auth.security.TokenRevocationService;
import com.fintrack.auth.service.AuthService;
import com.fintrack.auth.service.DemoService;
import com.fintrack.auth.service.GoogleAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
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
    private final com.fintrack.auth.twofactor.TwoFactorRecoveryService twoFactorRecovery;
    private final JwtUtil jwtUtil;
    private final TokenRevocationService tokenRevocationService;
    private final com.fintrack.auth.security.AuthCookies authCookies;

    @org.springframework.beans.factory.annotation.Value("${APP_VERSION:dev}")
    private String appVersion = "dev";

    // Separate per-account limiter: the IP can be faked via X-Forwarded-For, the
    // target email can't. Kept apart from the IP table so flooding it with fake
    // IPs can't reset an account's counter.
    private final LoginRateLimiter emailRateLimiter = new LoginRateLimiter();
    // Reset emails: at most 3 per address per hour, so the form can't be used to spam someone
    private final LoginRateLimiter resetEmailLimiter = new LoginRateLimiter(3, 60 * 60 * 1000L);
    // Forgot/reset have their own per-IP limit so using them doesn't use up the sign-in attempts
    private final LoginRateLimiter resetIpLimiter = new LoginRateLimiter(10, 15 * 60 * 1000L);
    private final com.fintrack.auth.service.PasswordResetService passwordResetService;

    // App-wide signup cap. The per-IP limit can be dodged with a fake
    // X-Forwarded-For, so this bounds scripted mass sign-ups regardless of IP.
    private static final String ALL_SIGNUPS = "all";
    private final LoginRateLimiter signupGlobalLimiter = new LoginRateLimiter(30, 10 * 60 * 1000L); // 30 per 10 min

    // ── POST /api/auth/register ───────────────────────────────────────────────

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request,
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
            return authCookies.issue(response);

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
            return authCookies.issue(response, !Boolean.FALSE.equals(request.getRememberMe()));

        } catch (com.fintrack.auth.twofactor.TwoFactorRequiredException e) {
            // Right password; the client asks for the app code and sends the login again with it
            return ResponseEntity.ok(Map.of("twoFactorRequired", true));
        } catch (com.fintrack.auth.twofactor.InvalidTwoFactorCodeException e) {
            log.warn("Login failed from IP {} for {}: wrong two-factor code", ip, request.getEmail());
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid code", "twoFactorRequired", true,
                                 "message", "That code didn't work. Enter the current code from your authenticator app, or a backup code."));
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
    public ResponseEntity<?> refresh(@RequestBody(required = false) Map<String, String> body,
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

        // From the HttpOnly cookie (web app; needs the CSRF header) or the body (API clients)
        String refreshToken = body != null ? body.get("refreshToken") : null;
        if ((refreshToken == null || refreshToken.isBlank())
                && com.fintrack.auth.security.AuthCookies.passesCsrfCheck(httpRequest)) {
            refreshToken = com.fintrack.auth.security.AuthCookies.read(httpRequest, com.fintrack.auth.security.AuthCookies.REFRESH);
        }
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Bad request", "message", "refreshToken is required."));
        }

        try {
            AuthResponse response = authService.refreshAccessToken(refreshToken);
            rateLimiter.reset(ip);
            // Keep the kind of session the user chose at sign-in; API clients (refresh token
            // in the body, no cookies) get lasting cookies as before
            return authCookies.issue(response, com.fintrack.auth.security.AuthCookies.wantsPersistent(httpRequest));
        } catch (Exception e) {
            log.warn("Token refresh failed from IP {}: {}", ip, e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid token", "message", "Refresh token is invalid or expired."));
        }
    }

    // ── POST /api/auth/logout ─────────────────────────────────────────────────

    /**
     * Signs the caller out everywhere: their access tokens and refresh tokens stop
     * working immediately. Always 204, so it is safe to call with an expired token.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                       HttpServletRequest httpRequest) {
        String jwt = authHeader != null && authHeader.startsWith("Bearer ") ? authHeader.substring(7)
                : com.fintrack.auth.security.AuthCookies.passesCsrfCheck(httpRequest)
                        ? com.fintrack.auth.security.AuthCookies.read(httpRequest, com.fintrack.auth.security.AuthCookies.ACCESS)
                        : null;
        if (jwt != null) {
            try {
                String userId = jwtUtil.isTokenValid(jwt) ? jwtUtil.extractUserId(jwt) : null;
                // The demo account is shared: one visitor signing out mustn't sign out everyone else
                boolean demo = DemoService.DEMO_EMAIL.equalsIgnoreCase(jwtUtil.extractUsername(jwt));
                if (userId != null && !demo) tokenRevocationService.revokeAll(java.util.UUID.fromString(userId));
            } catch (Exception e) {
                log.debug("Logout with an unusable token: {}", e.getMessage());
            }
        }
        return ResponseEntity.noContent().header(org.springframework.http.HttpHeaders.SET_COOKIE, authCookies.cleared()).build();
    }

    // ── POST /api/auth/forgot-password ────────────────────────────────────────

    /** Body: {"email"}. Always 202 with the same message, whether or not the address has an account. */
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody(required = false) Map<String, String> body,
                                            HttpServletRequest httpRequest) {
        String ip = resolveClientIp(httpRequest);
        String email = body != null && body.get("email") != null ? body.get("email").trim().toLowerCase() : "";
        if (!resetIpLimiter.tryConsume(ip)) {
            long retryAfter = resetIpLimiter.retryAfterSeconds(ip);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(retryAfter))
                    .body(Map.of("error", "Too many requests",
                                 "message", "Please try again in " + retryAfter + " seconds."));
        }
        // Over the per-address limit: answer the same as usual, just don't send another email
        if (!email.isEmpty() && resetEmailLimiter.tryConsume(email)) {
            passwordResetService.requestReset(email);
        }
        return ResponseEntity.accepted().body(Map.of("message",
                "If an account exists for that email, a reset link is on its way. It works for 30 minutes."));
    }

    // ── POST /api/auth/reset-password ─────────────────────────────────────────

    /** Body: {"token", "password"}. Sets the new password and signs out every session. */
    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody(required = false) Map<String, String> body,
                                           HttpServletRequest httpRequest) {
        String ip = resolveClientIp(httpRequest);
        if (!resetIpLimiter.tryConsume(ip)) {
            long retryAfter = resetIpLimiter.retryAfterSeconds(ip);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(retryAfter))
                    .body(Map.of("error", "Too many requests",
                                 "message", "Please try again in " + retryAfter + " seconds."));
        }
        String token = body != null ? body.get("token") : null;
        String password = body != null ? body.get("password") : null;
        try {
            if (!passwordResetService.resetPassword(token, password)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid link",
                        "message", "This reset link is invalid or has expired. Please request a new one."));
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid password", "message", e.getMessage()));
        }
        return ResponseEntity.ok().header(org.springframework.http.HttpHeaders.SET_COOKIE, authCookies.cleared())
                .body(Map.of("message", "Your password has been changed. Please sign in."));
    }

    // ── Two-factor recovery (lost authenticator and backup codes) ────────────

    @PostMapping("/two-factor-recovery")
    public ResponseEntity<?> requestTwoFactorRecovery(@RequestBody(required = false) Map<String, String> body,
                                                      HttpServletRequest httpRequest) {
        String ip = resolveClientIp(httpRequest);
        String email = body == null || body.get("email") == null ? "" : body.get("email").trim().toLowerCase();
        if (!rateLimiter.tryConsume(ip) || !resetEmailLimiter.tryConsume("2fa:" + email)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "Too many requests", "message", "Too many attempts. Please try again later."));
        }
        var user = authService.checkPassword(email, body == null ? null : body.get("password"));
        if (user.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Login failed", "message", "Invalid email or password."));
        }
        java.time.LocalDateTime at = twoFactorRecovery.request(user.get());
        return ResponseEntity.ok(Map.of("turnsOffAt", at.toString(), "message",
                "We emailed you. Two-factor sign-in will be turned off on " + at.toLocalDate()
                        + "; after that, sign in with just your password."));
    }

    @PostMapping("/two-factor-recovery/cancel")
    public ResponseEntity<?> cancelTwoFactorRecovery(@RequestBody(required = false) Map<String, String> body,
                                                     HttpServletRequest httpRequest) {
        if (!resetIpLimiter.tryConsume(resolveClientIp(httpRequest))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("message", "Please try again later."));
        }
        boolean cancelled = twoFactorRecovery.cancel(body == null ? null : body.get("token"));
        return cancelled
                ? ResponseEntity.ok(Map.of("message", "Cancelled. Two-factor sign-in stays on."))
                : ResponseEntity.badRequest().body(Map.of("message", "This link is invalid or the request was already cancelled or completed."));
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
            return authCookies.issue(response);
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
            return authCookies.issue(response);
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
                // The commit this build came from (set by CI); CI waits for it after a deploy
                "version",   appVersion,
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
