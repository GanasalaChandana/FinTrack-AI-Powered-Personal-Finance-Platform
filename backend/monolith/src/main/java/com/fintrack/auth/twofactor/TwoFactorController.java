package com.fintrack.auth.twofactor;

import com.fintrack.auth.entity.User;
import com.fintrack.auth.repository.UserRepository;
import com.fintrack.auth.service.DemoService;
import com.fintrack.common.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/** Settings → Security: turn two-factor sign-in on and off. */
@RestController
@RequestMapping("/api/users/me/2fa")
@RequiredArgsConstructor
public class TwoFactorController {

    private final TwoFactorService twoFactor;
    private final UserRepository users;

    @GetMapping
    public Map<String, Object> status(Authentication auth) {
        User u = me(auth);
        return Map.of("enabled", u.isTotpEnabled(), "backupCodesLeft", twoFactor.backupCodesLeft(u));
    }

    @PostMapping("/setup")
    public TwoFactorService.Setup setup(Authentication auth) {
        User u = me(auth);
        if (DemoService.DEMO_EMAIL.equalsIgnoreCase(u.getEmail())) {
            throw new BadRequestException("Two-factor sign-in isn't available on the demo account");
        }
        if (u.getPasswordHash() == null) {
            throw new BadRequestException("Set a password first: two-factor applies to password sign-in");
        }
        return twoFactor.start(u);
    }

    @PostMapping("/enable")
    public Map<String, List<String>> enable(Authentication auth, @RequestBody Map<String, String> body) {
        return Map.of("backupCodes", twoFactor.enable(me(auth), body.get("code")));
    }

    @PostMapping("/disable")
    public Map<String, Boolean> disable(Authentication auth, @RequestBody Map<String, String> body) {
        twoFactor.disable(me(auth), body.get("password"), body.get("code"));
        return Map.of("enabled", false);
    }

    @PostMapping("/backup-codes")
    public Map<String, List<String>> backupCodes(Authentication auth, @RequestBody Map<String, String> body) {
        return Map.of("backupCodes", twoFactor.regenerateBackupCodes(me(auth), body.get("code")));
    }

    private User me(Authentication auth) {
        if (auth == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return users.findByEmailIgnoreCase(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }
}
