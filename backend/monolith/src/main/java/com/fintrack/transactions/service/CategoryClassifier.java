package com.fintrack.transactions.service;

import org.springframework.stereotype.Component;

/**
 * Suggests a category for a transaction from keywords in its description and merchant.
 * Used when a transaction is created or imported without a category.
 */
@Component
public class CategoryClassifier {

    public String classify(String description, String merchant) {
        String text = (description + " " + (merchant != null ? merchant : "")).toLowerCase();

        // Food & Dining
        if (text.contains("restaurant") || text.contains("food") || text.contains("cafe") ||
            text.contains("coffee") || text.contains("pizza") || text.contains("lunch") ||
            text.contains("dinner") || text.contains("breakfast")) {
            return "Food & Dining";
        }

        // Transportation
        if (text.contains("uber") || text.contains("lyft") || text.contains("taxi") ||
            text.contains("gas") || text.contains("fuel") || text.contains("parking") ||
            text.contains("transport")) {
            return "Transportation";
        }

        // Shopping
        if (text.contains("amazon") || text.contains("walmart") || text.contains("target") ||
            text.contains("shop") || text.contains("store") || text.contains("mall")) {
            return "Shopping";
        }

        // Entertainment
        if (text.contains("movie") || text.contains("netflix") || text.contains("spotify") ||
            text.contains("game") || text.contains("concert") || text.contains("entertainment")) {
            return "Entertainment";
        }

        // Utilities
        if (text.contains("electric") || text.contains("water") || text.contains("internet") ||
            text.contains("phone") || text.contains("utility") || text.contains("bill")) {
            return "Utilities";
        }

        // Healthcare
        if (text.contains("doctor") || text.contains("pharmacy") || text.contains("hospital") ||
            text.contains("medical") || text.contains("health") || text.contains("dental")) {
            return "Healthcare";
        }

        // Income
        if (text.contains("salary") || text.contains("paycheck") || text.contains("deposit") ||
            text.contains("income") || text.contains("payment received")) {
            return "Income";
        }

        return "Other";
    }
}
