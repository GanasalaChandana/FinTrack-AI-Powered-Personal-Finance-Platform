package com.fintrack.auth.security;

import com.fintrack.auth.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Date;
import java.util.HexFormat;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

@Component
@Slf4j
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration:86400000}") // Default 24 hours
    private Long expiration;

    private static final int MIN_SECRET_BYTES = 32; // 256 bits for HS256

    // SHA-256 of secrets that are public (old defaults in this repo, tutorial
    // example keys, the README placeholder). Anyone who knows one could forge
    // a login for any user, so the server refuses to start with them.
    private static final Set<String> KNOWN_PUBLIC_SECRET_HASHES = Set.of(
            "e9cc80630a6552f2b192c6392f3dbdbdaa7b1028f28b1763c49f6d87d8de2843",
            "3354cfcf65c7b2e6840ea6f880aede239750cb1d063950c4e8fd9fbf9ec73a32",
            "80b43abc77d9ce5a808083f3afded947e7de2919302ae149351fd20898b4a2de");

    @PostConstruct
    void validateSecret() {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "JWT_SECRET is not set. Set it to a long random value, e.g. `openssl rand -base64 48`.");
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "JWT_SECRET is too short — it must be at least " + MIN_SECRET_BYTES + " bytes.");
        }
        if (KNOWN_PUBLIC_SECRET_HASHES.contains(sha256Hex(secret))) {
            throw new IllegalStateException(
                    "JWT_SECRET is a publicly known value. Replace it with a new random value.");
        }
    }

    private static String sha256Hex(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private SecretKey getSigningKey() {
        // Ensure the secret is at least 256 bits (32 bytes) for HS256
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    // Generate token from User object
    public String generateToken(User user) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", user.getId().toString());
        claims.put("email", user.getEmail());
        claims.put("role", user.getRole() != null ? user.getRole().toString() : "USER");

        log.debug("🔐 Generating token for user: {} (ID: {})", user.getEmail(), user.getId());
        return createToken(claims, user.getEmail());
    }

    // Generate token from username/email string (for backward compatibility)
    public String generateToken(String username) {
        Map<String, Object> claims = new HashMap<>();
        return createToken(claims, username);
    }

    private String createToken(Map<String, Object> claims, String subject) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expiration);

        String token = Jwts.builder()
                .claims(claims)
                .subject(subject)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey())
                .compact();

        log.debug("✅ Token created for: {} (expires: {})", subject, expiryDate);
        return token;
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (Exception e) {
            log.error("❌ Failed to parse JWT token: {}", e.getMessage());
            throw e;
        }
    }

    private Boolean isTokenExpired(String token) {
        try {
            return extractExpiration(token).before(new Date());
        } catch (Exception e) {
            log.error("❌ Token expiration check failed: {}", e.getMessage());
            return true; // Treat as expired if we can't check
        }
    }

    // Existing method - validate with username string
    public Boolean validateToken(String token, String username) {
        try {
            final String extractedUsername = extractUsername(token);
            boolean isValid = (extractedUsername.equals(username) && !isTokenExpired(token));

            if (isValid) {
                log.debug("✅ Token validated successfully for: {}", username);
            } else {
                log.warn("❌ Token validation failed for: {} (extracted: {})", username, extractedUsername);
            }

            return isValid;
        } catch (Exception e) {
            log.error("❌ Token validation error: {}", e.getMessage());
            return false;
        }
    }

    // NEW METHOD - validate with UserDetails (for Spring Security)
    public Boolean validateToken(String token, UserDetails userDetails) {
        return validateToken(token, userDetails.getUsername());
    }

    // NEW METHOD - simple token validity check (no user comparison)
    public Boolean isTokenValid(String token) {
        try {
            return !isTokenExpired(token);
        } catch (Exception e) {
            log.error("❌ Token validity check failed: {}", e.getMessage());
            return false;
        }
    }

    // Helper method to extract user ID from token
    public String extractUserId(String token) {
        Claims claims = extractAllClaims(token);
        return claims.get("userId", String.class);
    }

    // Helper method to extract email from token
    public String extractEmail(String token) {
        Claims claims = extractAllClaims(token);
        Object email = claims.get("email");
        return email != null ? email.toString() : extractUsername(token);
    }
}
