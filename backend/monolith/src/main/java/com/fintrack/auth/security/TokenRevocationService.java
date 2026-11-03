package com.fintrack.auth.security;

import com.fintrack.auth.repository.RefreshTokenRepository;
import com.fintrack.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Decides whether a signature-valid access token is still allowed, and revokes a
 * user's tokens on demand.
 *
 * Each token carries the user's token version from when it was issued. Revoking
 * bumps the version in the database, so every older token is refused. The current
 * version is cached for a few seconds so a busy page doesn't query the database on
 * every request; on this instance a revoke takes effect immediately (the cache entry
 * is dropped), on other instances within {@link #CACHE_MILLIS}.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class TokenRevocationService {

    static final long CACHE_MILLIS = 15_000;
    private static final int MAX_CACHED_USERS = 10_000;

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;

    private record Cached(Optional<Integer> version, long loadedAt) {}

    private final ConcurrentHashMap<UUID, Cached> cache = new ConcurrentHashMap<>();

    /** True if the user still exists and the token was issued at their current version. */
    public boolean isCurrent(UUID userId, int tokenVersion) {
        long now = System.currentTimeMillis();
        Cached c = cache.get(userId);
        if (c == null || now - c.loadedAt() > CACHE_MILLIS) {
            if (cache.size() > MAX_CACHED_USERS) cache.clear();
            c = new Cached(userRepository.findTokenVersionById(userId), now);
            cache.put(userId, c);
        }
        return c.version().map(v -> v == tokenVersion).orElse(false);
    }

    /** Signs the user out everywhere: every access and refresh token issued so far stops working. */
    @Transactional
    public void revokeAll(UUID userId) {
        userRepository.incrementTokenVersion(userId);
        refreshTokenRepository.deleteAllByUserId(userId);
        cache.remove(userId);
        log.info("All sessions revoked for user {}", userId);
    }

    /** Drop the cached entry, e.g. after the account is deleted. */
    public void forget(UUID userId) {
        cache.remove(userId);
    }
}
