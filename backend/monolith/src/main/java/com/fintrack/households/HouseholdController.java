package com.fintrack.households;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/** The signed-in user's household (X-User-Id comes from the verified session). */
@RestController
@RequestMapping("/api/households")
@RequiredArgsConstructor
public class HouseholdController {

    private final HouseholdService households;

    /** 200 with the household, or 204 when the user isn't in one. */
    @GetMapping("/me")
    public ResponseEntity<HouseholdService.HouseholdView> mine(@RequestHeader("X-User-Id") String userId) {
        return households.view(userId).map(ResponseEntity::ok).orElse(ResponseEntity.noContent().build());
    }

    @PostMapping
    public ResponseEntity<HouseholdService.HouseholdView> create(@RequestHeader("X-User-Id") String userId,
                                                                 @RequestBody Map<String, String> body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(households.create(userId, body.get("name")));
    }

    @PutMapping("/me")
    public HouseholdService.HouseholdView rename(@RequestHeader("X-User-Id") String userId, @RequestBody Map<String, String> body) {
        return households.rename(userId, body.get("name"));
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> delete(@RequestHeader("X-User-Id") String userId) {
        households.delete(userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/me/invites")
    public ResponseEntity<Map<String, String>> invite(@RequestHeader("X-User-Id") String userId, @RequestBody Map<String, String> body) {
        households.invite(userId, body.get("email"));
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "Invitation sent"));
    }

    @DeleteMapping("/me/invites/{id}")
    public ResponseEntity<Void> cancelInvite(@RequestHeader("X-User-Id") String userId, @PathVariable UUID id) {
        households.cancelInvite(userId, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/join")
    public HouseholdService.HouseholdView join(@RequestHeader("X-User-Id") String userId, @RequestBody Map<String, String> body) {
        return households.join(userId, body.get("token"));
    }

    @PostMapping("/me/leave")
    public ResponseEntity<Void> leave(@RequestHeader("X-User-Id") String userId) {
        households.leave(userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/me/members/{memberId}")
    public ResponseEntity<Void> removeMember(@RequestHeader("X-User-Id") String userId, @PathVariable String memberId) {
        households.removeMember(userId, memberId);
        return ResponseEntity.noContent().build();
    }
}
