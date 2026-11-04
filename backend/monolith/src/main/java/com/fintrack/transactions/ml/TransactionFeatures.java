package com.fintrack.transactions.ml;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Turns a transaction into the features the category model learns from. */
public final class TransactionFeatures {

    private TransactionFeatures() {}

    public static List<String> of(String merchant, String description, BigDecimal amount, String type) {
        List<String> f = new ArrayList<>();
        String m = normalise(merchant);
        if (!m.isEmpty()) f.add("merchant:" + m); // the whole merchant is the strongest signal
        for (String text : new String[] { merchant, description }) {
            for (String token : normalise(text).split(" ")) {
                if (token.length() >= 2 && !token.chars().allMatch(Character::isDigit)) f.add("w:" + token);
            }
        }
        if (amount != null && amount.signum() != 0) {
            // Order of magnitude: $1-9, $10-99, $100-999, ...
            int bucket = (int) Math.floor(Math.log10(Math.max(1.0, amount.abs().doubleValue())));
            f.add("amt:" + bucket);
        }
        if (type != null && !type.isBlank()) f.add("type:" + type.toLowerCase(Locale.ROOT));
        return f;
    }

    private static String normalise(String s) {
        if (s == null) return "";
        return s.toLowerCase(Locale.ROOT)
                .replaceAll("#\\s*\\d+", " ")
                .replaceAll("[^a-z0-9&]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
