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
    private final com.fintrack.transactions.ml.CategoryModelService model;

    /** A suggested category, where it came from, and how sure it is (0..1). */
    public record Suggestion(String category, String source, double confidence) {
        public static final String LEARNED = "learned";   // the user set it for this merchant
        public static final String MODEL = "model";       // predicted from the user's history
        public static final String KEYWORDS = "keywords"; // generic keyword rules
    }

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

    /** Category for a new transaction that came without one. */
    public String suggest(String userId, String merchant, String description,
                          java.math.BigDecimal amount, String type) {
        return suggestDetailed(userId, merchant, description, amount, type).category();
    }

    /**
     * In order: the category the user chose for this merchant; the model trained on
     * their history, when it is confident enough; the generic keyword rules.
     */
    public Suggestion suggestDetailed(String userId, String merchant, String description,
                                      java.math.BigDecimal amount, String type) {
        String k = key(merchant, description);
        if (userId != null && k != null) {
            var learned = rules.findByUserIdAndMerchantKey(userId, k);
            if (learned.isPresent()) return new Suggestion(learned.get().getCategory(), Suggestion.LEARNED, 1.0);
        }
        var predicted = model.predict(userId, merchant, description, amount, type);
        if (predicted.isPresent() && predicted.get().probability() >= com.fintrack.transactions.ml.CategoryModelService.MIN_CONFIDENCE) {
            return new Suggestion(predicted.get().category(), Suggestion.MODEL, predicted.get().probability());
        }
        return new Suggestion(classifier.classify(description, merchant), Suggestion.KEYWORDS, 0.5);
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
        model.invalidate(userId); // its labels just changed
        log.debug("Learned category '{}' for merchant '{}'", category, k);
    }
}
