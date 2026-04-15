package com.fintrack.auth.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * IP-based sliding-window rate limiter for auth endpoints.
 *
 * Policy: max 5 attempts within any 15-minute window per IP.
 * No external dependencies — uses an in-memory ConcurrentHashMap.
 *
 * For multi-instance deployments, swap the backing store for Redis
 * (increment a key with TTL) — the interface stays identical.
 */
@Component
@Slf4j
public class LoginRateLimiter {

    private static final int  MAX_ATTEMPTS      = 5;
    private static final long WINDOW_MILLIS      = 15 * 60 * 1000L; // 15 minutes
    private static final long CLEANUP_INTERVAL   = 10 * 60 * 1000L; // clean every 10 min
    private static final int  MAX_TRACKED_IPS    = 10_000;

    /** ip → timestamps of recent attempts (oldest first) */
    private final ConcurrentHashMap<String, Deque<Long>> attempts = new ConcurrentHashMap<>();
    private volatile long lastCleanup = System.currentTimeMillis();

    /**
     * Returns true and records the attempt if the IP is within limit.
     * Returns false (blocked) if the IP has exceeded MAX_ATTEMPTS in the window.
     */
    public boolean tryConsume(String ip) {
        periodicCleanup();

        long now = System.currentTimeMillis();
        Deque<Long> timestamps = attempts.computeIfAbsent(ip, k -> new ArrayDeque<>());

        synchronized (timestamps) {
            // Drop attempts outside the current window
            while (!timestamps.isEmpty() && now - timestamps.peekFirst() > WINDOW_MILLIS) {
                timestamps.pollFirst();
            }

            if (timestamps.size() >= MAX_ATTEMPTS) {
                long oldestInWindow = timestamps.peekFirst();
                long retryAfterSec  = (WINDOW_MILLIS - (now - oldestInWindow)) / 1000;
                log.warn("Rate limit exceeded for IP {} — {} attempts in last 15 min. Retry after {}s",
                        ip, timestamps.size(), retryAfterSec);
                return false; // blocked
            }

            timestamps.addLast(now);
            return true; // allowed
        }
    }

    /**
     * How many seconds until the oldest attempt in the window expires.
     * Returns 0 if the IP is not blocked.
     */
    public long retryAfterSeconds(String ip) {
        Deque<Long> timestamps = attempts.get(ip);
        if (timestamps == null) return 0;
        synchronized (timestamps) {
            if (timestamps.size() < MAX_ATTEMPTS) return 0;
            long now = System.currentTimeMillis();
            long oldest = timestamps.peekFirst() != null ? timestamps.peekFirst() : now;
            return Math.max(0, (WINDOW_MILLIS - (now - oldest)) / 1000);
        }
    }

    /** Clear all tracked state for an IP (e.g. after a successful login). */
    public void reset(String ip) {
        attempts.remove(ip);
    }

    /** Remove stale entries periodically to prevent unbounded memory growth. */
    private void periodicCleanup() {
        long now = System.currentTimeMillis();
        if (now - lastCleanup < CLEANUP_INTERVAL) return;
        lastCleanup = now;

        attempts.entrySet().removeIf(entry -> {
            Deque<Long> ts = entry.getValue();
            synchronized (ts) {
                return ts.isEmpty() || now - ts.peekLast() > WINDOW_MILLIS;
            }
        });

        // Hard cap to prevent memory exhaustion
        if (attempts.size() > MAX_TRACKED_IPS) {
            attempts.clear();
            log.warn("LoginRateLimiter: IP table exceeded {} entries — cleared.", MAX_TRACKED_IPS);
        }
    }
}
