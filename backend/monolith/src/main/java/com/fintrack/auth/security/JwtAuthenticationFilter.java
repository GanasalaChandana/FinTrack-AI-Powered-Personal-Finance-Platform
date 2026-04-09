package com.fintrack.auth.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.Enumeration;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

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
            final String jwt = authHeader.substring(7);
            log.debug("🔑 Validating JWT token for endpoint: {}", requestPath);

            // Validate token by signature + expiry only — NO database call
            if (jwtUtil.isTokenValid(jwt) && SecurityContextHolder.getContext().getAuthentication() == null) {

                final String userEmail = jwtUtil.extractUsername(jwt);
                final String userId    = jwtUtil.extractUserId(jwt);

                log.info("✅ JWT valid for user: {} (id: {})", userEmail, userId);

                if (userId != null) {
                    resolvedUserId[0] = userId;
                }

                // Build a minimal UserDetails from JWT claims — no DB needed
                List<SimpleGrantedAuthority> authorities =
                        List.of(new SimpleGrantedAuthority("ROLE_USER"));

                org.springframework.security.core.userdetails.User principal =
                        new org.springframework.security.core.userdetails.User(
                                userEmail != null ? userEmail : userId,
                                "",          // password not used for JWT auth
                                authorities);

                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(principal, null, authorities);

                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
                log.debug("🔒 User authenticated from JWT (no DB): {}", userEmail);

            } else {
                log.warn("❌ Invalid or expired JWT token for endpoint: {}", requestPath);
            }

        } catch (Exception e) {
            log.error("❌ JWT Authentication Error for {}: {}", requestPath, e.getMessage());
            // Don't throw — let Spring Security handle the unauthenticated request
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
