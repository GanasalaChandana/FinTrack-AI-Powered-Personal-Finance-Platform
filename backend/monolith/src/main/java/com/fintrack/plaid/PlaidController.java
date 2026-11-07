package com.fintrack.plaid;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Bank connections. The user id comes from the verified session (X-User-Id is set by the JWT filter). */
@RestController
@RequestMapping("/api/plaid")
@RequiredArgsConstructor
public class PlaidController {

    private final PlaidService plaid;

    /** Whether bank connections are available on this server. */
    @GetMapping("/status")
    public Map<String, Object> status() {
        return Map.of("enabled", plaid.enabled());
    }

    @PostMapping("/link-token")
    public ResponseEntity<Map<String, String>> linkToken(@RequestHeader("X-User-Id") String userId) {
        return ResponseEntity.ok(Map.of("linkToken", plaid.linkToken(userId)));
    }

    /** Body: {"publicToken", "institutionName"} from Plaid Link's onSuccess. */
    @PostMapping("/connect")
    public ResponseEntity<PlaidService.SyncResult> connect(@RequestHeader("X-User-Id") String userId,
                                                           @RequestBody Map<String, String> body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(plaid.connect(userId, body.get("publicToken"), body.get("institutionName")));
    }

    @GetMapping("/items")
    public List<PlaidService.ItemView> items(@RequestHeader("X-User-Id") String userId) {
        return plaid.list(userId);
    }

    @PostMapping("/items/{id}/sync")
    public PlaidService.SyncResult sync(@RequestHeader("X-User-Id") String userId, @PathVariable UUID id) {
        return plaid.syncNow(userId, id);
    }

    @DeleteMapping("/items/{id}")
    public ResponseEntity<Void> disconnect(@RequestHeader("X-User-Id") String userId, @PathVariable UUID id) {
        plaid.disconnect(userId, id);
        return ResponseEntity.noContent().build();
    }
}
