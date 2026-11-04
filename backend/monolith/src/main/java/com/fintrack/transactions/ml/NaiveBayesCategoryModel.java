package com.fintrack.transactions.ml;

import java.util.*;

/**
 * Multinomial Naive Bayes text classifier: transaction features -> category.
 *
 * Trained per user on their own categorised transactions, so it learns that user's
 * labels ("Groceries" vs "Food & Dining", their own merchants). Laplace smoothing;
 * probabilities come from a softmax over the log scores.
 */
public final class NaiveBayesCategoryModel {

    /** One labelled example: its features and category. */
    public record Example(List<String> features, String category) {}

    /** Most likely category and its probability (0..1). */
    public record Prediction(String category, double probability) {}

    private final Map<String, Integer> docsPerCategory = new HashMap<>();
    private final Map<String, Map<String, Integer>> featureCounts = new HashMap<>();
    private final Map<String, Integer> featuresPerCategory = new HashMap<>();
    private final Set<String> vocabulary = new HashSet<>();
    private int totalDocs;

    public static NaiveBayesCategoryModel train(Collection<Example> examples) {
        NaiveBayesCategoryModel m = new NaiveBayesCategoryModel();
        for (Example e : examples) m.add(e);
        return m;
    }

    private void add(Example e) {
        totalDocs++;
        docsPerCategory.merge(e.category(), 1, Integer::sum);
        Map<String, Integer> counts = featureCounts.computeIfAbsent(e.category(), k -> new HashMap<>());
        for (String f : e.features()) {
            counts.merge(f, 1, Integer::sum);
            featuresPerCategory.merge(e.category(), 1, Integer::sum);
            vocabulary.add(f);
        }
    }

    public int categoryCount() { return docsPerCategory.size(); }

    public int exampleCount() { return totalDocs; }

    /** Empty when the model has nothing to go on (untrained, or no known features). */
    public Optional<Prediction> predict(List<String> features) {
        if (totalDocs == 0 || docsPerCategory.size() < 2) return Optional.empty();
        if (features.stream().noneMatch(vocabulary::contains)) return Optional.empty();

        int v = vocabulary.size();
        Map<String, Double> logScores = new HashMap<>();
        for (var entry : docsPerCategory.entrySet()) {
            String c = entry.getKey();
            double score = Math.log((entry.getValue() + 1.0) / (totalDocs + docsPerCategory.size()));
            Map<String, Integer> counts = featureCounts.get(c);
            int total = featuresPerCategory.getOrDefault(c, 0);
            for (String f : features) {
                if (!vocabulary.contains(f)) continue; // unseen everywhere: no information
                score += Math.log((counts.getOrDefault(f, 0) + 1.0) / (total + v));
            }
            logScores.put(c, score);
        }
        double max = Collections.max(logScores.values());
        double sum = 0;
        String best = null;
        double bestScore = Double.NEGATIVE_INFINITY;
        for (var e : logScores.entrySet()) {
            sum += Math.exp(e.getValue() - max);
            if (e.getValue() > bestScore) { bestScore = e.getValue(); best = e.getKey(); }
        }
        return Optional.of(new Prediction(best, 1.0 / sum)); // exp(best - max) = 1
    }
}
