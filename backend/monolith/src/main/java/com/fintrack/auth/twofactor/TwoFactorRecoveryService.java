package com.fintrack.auth.twofactor;

import com.fintrack.auth.entity.User;
import com.fintrack.auth.repository.UserRepository;
import com.fintrack.common.BadRequestException;
import com.fintrack.common.EmailService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

/**
 * For someone who lost both their authenticator and their backup codes: with the right
 * password they can ask to turn two-factor off. It happens only after a waiting period,
 * and the account's email gets a link to cancel, so a stolen password alone can't
 * quietly remove two-factor. Signing in with a code also cancels it.
 */
@Service
public class TwoFactorRecoveryService {

    private final UserRepository users;
    private final EmailService email;
    private final String appUrl;
    private final int waitDays;
    private final SecureRandom random = new SecureRandom();

    public TwoFactorRecoveryService(UserRepository users, EmailService email,
                                    @Value("${app.base-url:https://fintrack-liart.vercel.app}") String appUrl,
                                    @Value("${app.two-factor.recovery-days:3}") int waitDays) {
        this.users = users;
        this.email = email;
        this.appUrl = appUrl.replaceAll("/+$", "");
        this.waitDays = waitDays;
    }

    /** Starts (or reports the already pending) recovery. Returns when two-factor will turn off. */
    @Transactional
    public LocalDateTime request(User user) {
        if (!user.isTotpEnabled()) throw new BadRequestException("Two-factor sign-in isn't on for this account");
        if (user.getTotpRecoveryAt() != null) return user.getTotpRecoveryAt(); // don't restart the clock
        byte[] b = new byte[32];
        random.nextBytes(b);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(b);
        LocalDateTime at = LocalDateTime.now().plusDays(waitDays);
        user.setTotpRecoveryAt(at);
        user.setTotpRecoveryCancelHash(sha256(token));
        users.save(user);
        String when = at.format(DateTimeFormatter.ofPattern("EEEE d MMMM 'at' HH:mm 'UTC'", Locale.ENGLISH));
        boolean sent = email.send(user.getEmail(), "FinTrack: two-factor sign-in will be turned off", """
                Someone (hopefully you) said they lost access to their authenticator app and backup codes,
                and asked to turn off two-factor sign-in for your FinTrack account.

                It will be turned off on %s. After that, your password alone will sign you in.

                If this wasn't you, cancel it now and change your password:
                %s/two-factor-recovery/cancel?token=%s

                Signing in with a code from your authenticator app also cancels it.

                FinTrack
                """.formatted(when, appUrl, token));
        if (!sent) throw new BadRequestException("Couldn't send the confirmation email, so recovery wasn't started. Please try again later.");
        return at;
    }

    /** From the emailed link. True if a pending recovery was cancelled. */
    @Transactional
    public boolean cancel(String token) {
        if (token == null || token.isBlank()) return false;
        return users.findByTotpRecoveryCancelHash(sha256(token)).map(u -> {
            clear(u);
            users.save(u);
            return true;
        }).orElse(false);
    }

    /** True when the waiting period is over (two-factor should then be skipped and turned off). */
    public boolean isDue(User user) {
        return user.getTotpRecoveryAt() != null && !LocalDateTime.now().isBefore(user.getTotpRecoveryAt());
    }

    /** Turns two-factor off at the end of a recovery. */
    @Transactional
    public void complete(User user) {
        user.setTotpEnabled(false);
        user.setTotpSecret(null);
        user.setTotpBackupCodes(null);
        user.setTotpLastStep(0L);
        clear(user);
        users.save(user);
    }

    static void clear(User user) {
        user.setTotpRecoveryAt(null);
        user.setTotpRecoveryCancelHash(null);
    }

    private static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
