package com.fintrack.auth.security;

import com.fintrack.auth.dto.AuthResponse;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * The session lives in two HttpOnly cookies, so page scripts (and anything injected
 * into the page) can't read the tokens:
 *  - {@value #ACCESS}: the JWT, sent with every API call
 *  - {@value #REFRESH}: the refresh token, only sent to /api/auth (refresh / logout)
 *
 * The web app reaches the API through its own domain (a Vercel rewrite), so these
 * are first-party cookies; SameSite=Lax keeps other sites from sending them on
 * POST/PUT/DELETE, and {@link #CSRF_HEADER} is required on top of that.
 */
@Component
public class AuthCookies {

    public static final String ACCESS = "ft_at";
    public static final String REFRESH = "ft_rt";
    /** Must be present on state-changing requests authenticated by cookie. */
    public static final String CSRF_HEADER = "X-Requested-With";

    private static final Duration REFRESH_TTL = Duration.ofDays(30);

    private final Duration accessTtl;
    private final boolean secure;

    public AuthCookies(@Value("${jwt.expiration:86400000}") long accessMillis,
                       @Value("${auth.cookie.secure:true}") boolean secure) {
        this.accessTtl = Duration.ofMillis(accessMillis);
        this.secure = secure;
    }

    /** 200 with the session cookies set; the tokens themselves are left out of the body. */
    public ResponseEntity<AuthResponse> issue(AuthResponse auth) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie(ACCESS, auth.getToken(), "/", accessTtl).toString())
                .header(HttpHeaders.SET_COOKIE, cookie(REFRESH, auth.getRefreshToken(), "/api/auth", REFRESH_TTL).toString())
                .body(AuthResponse.builder()
                        .user(auth.getUser())
                        .refreshTokenExpiry(auth.getRefreshTokenExpiry())
                        .build());
    }

    /** Set-Cookie values that delete both cookies. */
    public String[] cleared() {
        return new String[] {
                cookie(ACCESS, "", "/", Duration.ZERO).toString(),
                cookie(REFRESH, "", "/api/auth", Duration.ZERO).toString(),
        };
    }

    private ResponseCookie cookie(String name, String value, String path, Duration maxAge) {
        return ResponseCookie.from(name, value == null ? "" : value)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax")
                .path(path)
                .maxAge(maxAge)
                .build();
    }

    public static String read(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) return c.getValue();
        }
        return null;
    }

    /** Cookie-authenticated writes must carry the custom header (a cross-site form can't add it). */
    public static boolean passesCsrfCheck(HttpServletRequest request) {
        String m = request.getMethod();
        if ("GET".equals(m) || "HEAD".equals(m) || "OPTIONS".equals(m)) return true;
        String h = request.getHeader(CSRF_HEADER);
        return h != null && !h.isBlank();
    }
}
