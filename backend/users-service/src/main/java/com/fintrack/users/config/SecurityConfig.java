package com.fintrack.users.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
@Slf4j
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        log.info("🔧 Configuring Security Filter Chain...");

        http
                // ✅ CORS + CSRF
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)

                // ✅ Stateless API (no sessions)
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // ✅ Authorization rules
                .authorizeHttpRequests(auth -> auth
                        // Allow all OPTIONS requests for CORS preflight
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // 🔓 Public endpoints (no token required)
                        .requestMatchers(
                                "/api/auth/**", // register, login, google
                                "/oauth2/**", // OAuth2 endpoints
                                "/login/oauth2/**",
                                "/actuator/**",
                                "/actuator/health",
                                "/api/users/health", // Health checks
                                "/error")
                        .permitAll()

                        // 🔒 Everything else requires authentication
                        .anyRequest().authenticated())

                // ✅ CRITICAL: Disable default login mechanisms (prevents browser popup)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable);

        log.info("✅ Security Filter Chain configured successfully");
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        log.info("🌐 Configuring CORS...");

        CorsConfiguration configuration = new CorsConfiguration();

        // ✅ Exact origins for local development
        configuration.setAllowedOrigins(Arrays.asList(
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:3001",
                "http://127.0.0.1:3001",
                "http://localhost:3002",
                "http://127.0.0.1:3002",
                "http://localhost:3003",
                "http://127.0.0.1:3003",
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:8080", // API Gateway
                "http://127.0.0.1:8080"));

        // ✅ Wildcard patterns for Vercel deployments
        configuration.setAllowedOriginPatterns(Arrays.asList(
                "https://fintrack-liart.vercel.app",
                "https://fintrack-liart-*.vercel.app",
                "https://*.vercel.app"));

        // ✅ All HTTP methods
        configuration.setAllowedMethods(Arrays.asList(
                "GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"));

        // ✅ Allow all headers
        configuration.setAllowedHeaders(Arrays.asList("*"));

        // ✅ Expose headers that frontend needs
        configuration.setExposedHeaders(Arrays.asList(
                "Authorization",
                "Content-Type",
                "Accept",
                "X-User-Id"));

        // ✅ Allow credentials (cookies, auth headers)
        configuration.setAllowCredentials(true);

        // ✅ Cache preflight for 1 hour
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);

        log.info("✅ CORS configured successfully");
        log.info("   - Allowed Origins: {}", configuration.getAllowedOrigins());
        log.info("   - Allowed Methods: {}", configuration.getAllowedMethods());

        return source;
    }
}