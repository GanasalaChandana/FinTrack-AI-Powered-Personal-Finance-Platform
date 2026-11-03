package com.fintrack.transactions.service;

import com.fintrack.transactions.entity.CategoryRule;
import com.fintrack.transactions.repository.CategoryRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Locale;

/**
 * Categories learned from the user: changing a transaction's category remembers
 * the choice for that merchant, and new transactions from it get that category
 * before the generic keyword rules are tried.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CategoryRuleService {

    private final CategoryRuleRepository rules;
    private final CategoryClassifier classifier;

    /**
     * Normalised merchant used to match transactions: lower case, store numbers
     * ("#1234") and extra spaces removed. Falls back to the description.
     */
    public static String key(String merchant, String description) {
        String raw = merchant != null && !merchant.isBlank() ? merchant : description;
        if (raw == null) return null;
        String k = raw.toLowerCase(Locale.ROOT)
                .replaceAll("#\\s*\\d+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (k.isEmpty()) return null;
        return k.length() > 255 ? k.substring(0, 255) : k;
    }

    /** The user's own category for this merchant, else the keyword rules. */
    public String suggest(String userId, String merchant, String description) {
        String k = key(merchant, description);
        if (userId != null && k != null) {
            var learned = rules.findByUserIdAndMerchantKey(userId, k);
            if (learned.isPresent()) return learned.get().getCategory();
        }
        return classifier.classify(description, merchant);
    }

    /** Remembers the user's category choice for this merchant. */
    public void learn(String userId, String merchant, String description, String category) {
        String k = key(merchant, description);
        if (userId == null || k == null || category == null || category.isBlank()) return;
        CategoryRule rule = rules.findByUserIdAndMerchantKey(userId, k).orElseGet(() -> {
            CategoryRule r = new CategoryRule();
            r.setUserId(userId);
            r.setMerchantKey(k);
            return r;
        });
        rule.setCategory(category.length() > 100 ? category.substring(0, 100) : category);
        rule.setUpdatedAt(LocalDateTime.now());
        rules.save(rule);
        log.debug("Learned category '{}' for merchant '{}'", category, k);
    }
}
