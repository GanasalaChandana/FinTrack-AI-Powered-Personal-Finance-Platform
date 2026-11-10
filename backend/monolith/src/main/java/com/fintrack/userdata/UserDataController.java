package com.fintrack.userdata;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fintrack.common.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * The signed-in user's small app data (debts, net worth, custom categories, ...),
 * so it follows them across devices. Values are JSON; keys look like the browser's
 * storage keys ("fintrack-debts", "fintrack:settings-categories").
 */
@RestController
@RequestMapping("/api/user-data")
@RequiredArgsConstructor
public class UserDataController {

    static final Pattern KEY = Pattern.compile("fintrack[-:][a-zA-Z0-9:_.-]{1,90}");
    static final int MAX_VALUE_CHARS = 256 * 1024, MAX_KEYS = 200;

    private final UserDataRepository repo;
    private final ObjectMapper json;

    /** Everything, as {key: value}. */
    @GetMapping
    public Map<String, JsonNode> all(@RequestHeader("X-User-Id") String userId) {
        Map<String, JsonNode> out = new LinkedHashMap<>();
        for (UserData d : repo.findByUserId(userId)) {
            try { out.put(d.getKey(), json.readTree(d.getValue())); } catch (Exception ignored) { /* skip a corrupt row */ }
        }
        return out;
    }

    @PutMapping("/{key}")
    @Transactional
    public ResponseEntity<Void> put(@RequestHeader("X-User-Id") String userId, @PathVariable String key,
                                    @RequestBody JsonNode value) {
        checkKey(key);
        String text = value.toString();
        if (text.length() > MAX_VALUE_CHARS) throw new BadRequestException("That's too much data to save");
        boolean exists = repo.existsById(new UserData.Key(userId, key));
        if (!exists && repo.countByUserId(userId) >= MAX_KEYS) throw new BadRequestException("Too many saved items");
        repo.save(new UserData(userId, key, text, LocalDateTime.now()));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{key}")
    public ResponseEntity<Void> delete(@RequestHeader("X-User-Id") String userId, @PathVariable String key) {
        checkKey(key);
        repo.deleteById(new UserData.Key(userId, key));
        return ResponseEntity.noContent().build();
    }

    private static void checkKey(String key) {
        if (key == null || !KEY.matcher(key).matches()) throw new BadRequestException("Unknown data key");
    }
}
