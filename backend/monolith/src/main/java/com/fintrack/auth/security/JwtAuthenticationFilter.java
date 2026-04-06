package com.fintrack.auth.security;

import com.fintrack.auth.service.UserService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserService userService;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) throws ServletException {
        String path = request.getRequestURI();
        // Skip JWT validation for public endpoints
        return path.startsWith("/api/auth/") ||
                path.startsWith("/oauth2/") ||
                path.startsWith("/login/oauth2/") ||
                path.startsWith("/actuator/") ||
                path.startsWith("/swagger-ui/") ||
                path.startsWith("/v3/api-docs/") ||
                path.endsWith("/health") ||
                path.equals("/error");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        final String requestPath = request.getRequestURI();
        final String authHeader = request.getHeader("Authorization");

        // Skip JWT validation for public endpoints
        if (isPublicEndpoint(requestPath)) {
            log.debug("⚪ Public endpoint: {}", requestPath);
            filterChain.doFilter(request, response);
            return;
        }

        // Check if Authorization header exists
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("⚠️ No valid Authorization header for protected endpoint: {}", requestPath);
            filterChain.doFilter(request, response);
            return;
        }

        final String[] resolvedUserId = {null};

        try {
            // Extract token
            final String jwt = authHeader.substring(7);
            log.debug("🔑 Validating JWT token for endpoint: {}", requestPath);

            // Extract email from token
            final String userEmail = jwtUtil.extractUsername(jwt);

            // If user is not already authenticated
            if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {

                // Load user details
                UserDetails userDetails = userService.loadUserByUsername(userEmail);

                // Validate token
                if (jwtUtil.validateToken(jwt, userDetails)) {
                    log.info("✅ JWT valid for user: {}", userEmail);

                    // Extract userId from JWT claims and store for header injection
                    String userId = jwtUtil.extractUserId(jwt);
                    if (userId != null) {
                        resolvedUserId[0] = userId;
                        log.debug("👤 Extracted userId from JWT: {}", userId);
                    }

                    // Create authentication token
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities());

                    authToken.setDetails(
                            new WebAuthenticationDetailsSource().buildDetails(request));

                    // Set authentication in context
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                    log.debug("🔒 User authenticated: {}", userEmail);
                } else {
                    log.warn("❌ Invalid JWT token for user: {}", userEmail);
                }
            }

        } catch (Exception e) {
            log.error("❌ JWT Authentication Error: {}", e.getMessage());
            // Don't throw - let the request continue and fail at authorization
        }

        // If we extracted a userId, wrap the request to inject X-User-Id header
        // so all controllers (budgets, goals, alerts, etc.) receive it automatically
        if (resolvedUserId[0] != null) {
            final String userId = resolvedUserId[0];
            HttpServletRequestWrapper wrappedRequest = new HttpServletRequestWrapper(request) {
                @Override
                public String getHeader(String name) {
                    if ("X-User-Id".equalsIgnoreCase(name)) {
                        return userId;
                    }
                    return super.getHeader(name);
                }

                @Override
                public Enumeration<String> getHeaders(String name) {
                    if ("X-User-Id".equalsIgnoreCase(name)) {
                        return Collections.enumeration(Collections.singletonList(userId));
                    }
                    return super.getHeaders(name);
                }

                @Override
                public Enumeration<String> getHeaderNames() {
                    java.util.List<String> names = Collections.list(super.getHeaderNames());
                    if (!names.contains("X-User-Id")) {
                        names.add("X-User-Id");
                    }
                    return Collections.enumeration(names);
                }
            };
            filterChain.doFilter(wrappedRequest, response);
        } else {
            filterChain.doFilter(request, response);
        }
    }

    /**
     * Check if the endpoint is public (doesn't require authentication)
     */
    private boolean isPublicEndpoint(String path) {
        return path.startsWith("/api/auth/") ||
                path.startsWith("/oauth2/") ||
                path.startsWith("/login/oauth2/") ||
                path.startsWith("/actuator/") ||
                path.equals("/error") ||
                path.endsWith("/health");
    }
}
