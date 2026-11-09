package com.fintrack.auth.twofactor;

import com.fintrack.auth.entity.User;
import com.fintrack.auth.repository.UserRepository;
import com.fintrack.common.BadRequestException;
import com.fintrack.plaid.TokenCipher;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.function.LongSupplier;

/**
 * Two-factor sign-in with an authenticator app. The secret is stored encrypted;
 * backup codes are stored as SHA-256 hashes and each works once.
 */
@Service
public class TwoFactorService {

    public static final int BACKUP_CODES = 10;
    private static final String ISSUER = "FinTrack";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final TokenCipher cipher;
    private final LongSupplier clock;

    @org.springframework.beans.factory.annotation.Autowired
    public TwoFactorService(UserRepository users, PasswordEncoder passwords, @Value("${jwt.secret:}") String jwtSecret) {
        this(users, passwords, new TokenCipher("", "totp-secrets|" + jwtSecret), System::currentTimeMillis);
    }

    TwoFactorService(UserRepository users, PasswordEncoder passwords, TokenCipher cipher, LongSupplier clock) {
        this.users = users;
        this.passwords = passwords;
        this.cipher = cipher;
        this.clock = clock;
    }

    public record Setup(String secret, String otpauthUrl) {}

    /** Step 1: a new secret for the app to scan. Not active until {@link #enable} confirms a code. */
    @Transactional
    public Setup start(User user) {
        if (user.isTotpEnabled()) throw new BadRequestException("Two-factor sign-in is already on");
        String secret = Totp.newSecret();
        user.setTotpSecret(cipher.encrypt(secret));
        user.setTotpLastStep(0L);
        users.save(user);
        String label = URLEncoder.encode(ISSUER + ":" + user.getEmail(), StandardCharsets.UTF_8).replace("+", "%20");
        return new Setup(secret, "otpauth://totp/" + label + "?secret=" + secret + "&issuer=" + ISSUER
                + "&algorithm=SHA1&digits=6&period=30");
    }

    /** Step 2: the user typed a code from the app, proving it's set up. Returns the backup codes (shown once). */
    @Transactional
    public List<String> enable(User user, String code) {
        if (user.isTotpEnabled()) throw new BadRequestException("Two-factor sign-in is already on");
        if (user.getTotpSecret() == null) throw new BadRequestException("Start the setup first");
        if (!checkTotp(user, code)) throw new BadRequestException("That code didn't match. Check the time on your phone and try again.");
        user.setTotpEnabled(true);
        List<String> codes = newBackupCodes(user);
        users.save(user);
        return codes;
    }

    /** Turning it off needs the password and a current code (or a backup code). */
    @Transactional
    public void disable(User user, String password, String code) {
        if (!user.isTotpEnabled()) throw new BadRequestException("Two-factor sign-in is already off");
        if (password == null || user.getPasswordHash() == null || !passwords.matches(password, user.getPasswordHash())) {
            throw new BadRequestException("Password is incorrect");
        }
        if (!verify(user, code)) throw new BadRequestException("That code didn't match");
        user.setTotpEnabled(false);
        user.setTotpSecret(null);
        user.setTotpBackupCodes(null);
        user.setTotpLastStep(0L);
        users.save(user);
    }

    /** New backup codes; the old ones stop working. Needs a current code. */
    @Transactional
    public List<String> regenerateBackupCodes(User user, String code) {
        if (!user.isTotpEnabled()) throw new BadRequestException("Two-factor sign-in is off");
        if (!checkTotp(user, code)) throw new BadRequestException("That code didn't match");
        List<String> codes = newBackupCodes(user);
        users.save(user);
        return codes;
    }

    public int backupCodesLeft(User user) {
        String s = user.getTotpBackupCodes();
        return s == null || s.isBlank() ? 0 : s.split(",").length;
    }

    /** At sign-in: an app code, or an unused backup code (which is then used up). Saves the user. */
    @Transactional
    public boolean verify(User user, String code) {
        if (code == null) return false;
        String c = code.replaceAll("[\\s-]", "");
        if (c.matches("\\d{6}")) {
            boolean ok = checkTotp(user, c);
            if (ok) users.save(user);
            return ok;
        }
        String hash = sha256(c.toLowerCase());
        List<String> left = new ArrayList<>(user.getTotpBackupCodes() == null ? List.of()
                : Arrays.asList(user.getTotpBackupCodes().split(",")));
        boolean found = false;
        for (String h : left) found |= MessageDigest.isEqual(h.getBytes(), hash.getBytes());
        if (!found) return false;
        left.remove(hash);
        user.setTotpBackupCodes(left.isEmpty() ? null : String.join(",", left));
        users.save(user);
        return true;
    }

    private boolean checkTotp(User user, String code) {
        if (user.getTotpSecret() == null) return false;
        long last = user.getTotpLastStep() == null ? 0 : user.getTotpLastStep();
        long step = Totp.matchStep(cipher.decrypt(user.getTotpSecret()), code == null ? null : code.trim(), clock.getAsLong(), last);
        if (step < 0) return false;
        user.setTotpLastStep(step); // the same code can't be used again
        return true;
    }

    private List<String> newBackupCodes(User user) {
        List<String> codes = new ArrayList<>(), hashes = new ArrayList<>();
        String alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes (0/o, 1/l/i)
        for (int i = 0; i < BACKUP_CODES; i++) {
            StringBuilder sb = new StringBuilder();
            for (int j = 0; j < 10; j++) sb.append(alphabet.charAt(RANDOM.nextInt(alphabet.length())));
            String code = sb.substring(0, 5) + "-" + sb.substring(5);
            codes.add(code);
            hashes.add(sha256(code.replace("-", "")));
        }
        user.setTotpBackupCodes(String.join(",", hashes));
        return codes;
    }

    private static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
