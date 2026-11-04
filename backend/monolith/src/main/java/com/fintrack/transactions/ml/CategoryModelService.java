package com.fintrack.transactions.ml;

import com.fintrack.transactions.entity.Transaction;
import com.fintrack.transactions.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-user category model (see {@link NaiveBayesCategoryModel}), trained on the
 * user's own categorised transactions and cached for a few minutes.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CategoryModelService {

    /** Below this, a prediction isn't used (the keyword rules are tried instead). */
    public static final double MIN_CONFIDENCE = 0.6;
    /** Too few examples and the model mostly guesses. */
    static final int MIN_EXAMPLES = 15;
    private static final Duration CACHE_TTL = Duration.ofMinutes(5);
    private static final Set<String> NOT_A_LABEL = Set.of("", "other", "uncategorized", "uncategorised");

    private final TransactionRepository transactions;

    private record Cached(NaiveBayesCategoryModel model, Instant trainedAt) {}
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();

    /** How the model does on the user's own data (5-fold cross-validation). */
    public record Stats(boolean trained, int examples, int categories,
                        Double accuracy, Double baselineAccuracy,
                        Double confidentAccuracy, Double coverage, double minConfidence) {}

    public Optional<NaiveBayesCategoryModel.Prediction> predict(String userId, String merchant, String description,
                                                                 BigDecimal amount, String type) {
        if (userId == null) return Optional.empty();
        NaiveBayesCategoryModel model = model(userId);
        if (model == null) return Optional.empty();
        return model.predict(TransactionFeatures.of(merchant, description, amount, type));
    }

    /** Forget the cached model (the user's labels changed). */
    public void invalidate(String userId) {
        if (userId != null) cache.remove(userId);
    }

    public Stats stats(String userId) {
        List<NaiveBayesCategoryModel.Example> data = examples(userId);
        int categories = (int) data.stream().map(NaiveBayesCategoryModel.Example::category).distinct().count();
        if (data.size() < MIN_EXAMPLES || categories < 2) {
            return new Stats(false, data.size(), categories, null, null, null, null, MIN_CONFIDENCE);
        }
        // Majority-class baseline: what "always guess the most common category" scores
        Map<String, Long> freq = new HashMap<>();
        data.forEach(e -> freq.merge(e.category(), 1L, Long::sum));
        double baseline = (double) Collections.max(freq.values()) / data.size();

        int k = 5, correct = 0, confident = 0, confidentCorrect = 0;
        for (int fold = 0; fold < k; fold++) {
            List<NaiveBayesCategoryModel.Example> train = new ArrayList<>(), test = new ArrayList<>();
            for (int i = 0; i < data.size(); i++) (i % k == fold ? test : train).add(data.get(i));
            NaiveBayesCategoryModel m = NaiveBayesCategoryModel.train(train);
            for (var e : test) {
                var p = m.predict(e.features());
                boolean ok = p.isPresent() && p.get().category().equals(e.category());
                if (ok) correct++;
                if (p.isPresent() && p.get().probability() >= MIN_CONFIDENCE) {
                    confident++;
                    if (ok) confidentCorrect++;
                }
            }
        }
        return new Stats(true, data.size(), categories,
                (double) correct / data.size(), baseline,
                confident == 0 ? null : (double) confidentCorrect / confident,
                (double) confident / data.size(), MIN_CONFIDENCE);
    }

    private NaiveBayesCategoryModel model(String userId) {
        Cached c = cache.get(userId);
        if (c != null && c.trainedAt().plus(CACHE_TTL).isAfter(Instant.now())) return c.model();
        List<NaiveBayesCategoryModel.Example> data = examples(userId);
        NaiveBayesCategoryModel m = NaiveBayesCategoryModel.train(data);
        boolean usable = data.size() >= MIN_EXAMPLES && m.categoryCount() >= 2;
        cache.put(userId, new Cached(usable ? m : null, Instant.now()));
        return usable ? m : null;
    }

    private List<NaiveBayesCategoryModel.Example> examples(String userId) {
        List<NaiveBayesCategoryModel.Example> out = new ArrayList<>();
        List<Transaction> txns = new ArrayList<>(transactions.findByUserId(userId));
        txns.sort(Comparator.comparing(Transaction::getId, Comparator.nullsLast(Comparator.naturalOrder())));
        for (Transaction t : txns) {
            String label = t.getCategory() == null ? "" : t.getCategory().trim();
            if (NOT_A_LABEL.contains(label.toLowerCase(Locale.ROOT))) continue;
            out.add(new NaiveBayesCategoryModel.Example(
                    TransactionFeatures.of(t.getMerchant(), t.getDescription(), t.getAmount(), t.getType()), label));
        }
        return out;
    }
}
