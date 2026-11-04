package com.fintrack.transactions.ml;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Naive Bayes category model")
class NaiveBayesCategoryModelTest {

    private static NaiveBayesCategoryModel.Example ex(String merchant, String desc, double amount, String category) {
        return new NaiveBayesCategoryModel.Example(
                TransactionFeatures.of(merchant, desc, BigDecimal.valueOf(amount), "EXPENSE"), category);
    }

    private static NaiveBayesCategoryModel trained() {
        List<NaiveBayesCategoryModel.Example> data = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            data.add(ex("Green Leaf Market", "weekly groceries", 60 + i, "Groceries"));
            data.add(ex("Corner Bakery #" + i, "bread and coffee", 8 + i, "Dining"));
            data.add(ex("City Power", "electricity bill", 120 + i, "Utilities"));
        }
        return NaiveBayesCategoryModel.train(data);
    }

    @Test
    @DisplayName("predicts a known merchant's category with high confidence")
    void knownMerchant() {
        var p = trained().predict(TransactionFeatures.of("Green Leaf Market", "", BigDecimal.valueOf(55), "EXPENSE"));
        assertThat(p).isPresent();
        assertThat(p.get().category()).isEqualTo("Groceries");
        assertThat(p.get().probability()).isGreaterThan(0.9);
    }

    @Test
    @DisplayName("generalises from words: a new store number, or a description it has seen")
    void generalises() {
        var m = trained();
        assertThat(m.predict(TransactionFeatures.of("Corner Bakery #99", null, BigDecimal.valueOf(9), "EXPENSE")).get().category())
                .isEqualTo("Dining");
        assertThat(m.predict(TransactionFeatures.of("Unknown Co", "electricity bill October", BigDecimal.valueOf(130), "EXPENSE")).get().category())
                .isEqualTo("Utilities");
    }

    @Test
    @DisplayName("no prediction without known features or with a single category")
    void abstains() {
        assertThat(trained().predict(TransactionFeatures.of("Zzz", "qqq", null, null))).isEmpty();
        var one = NaiveBayesCategoryModel.train(List.of(ex("A", "x", 1, "Only")));
        assertThat(one.predict(TransactionFeatures.of("A", "x", BigDecimal.ONE, "EXPENSE"))).isEmpty();
    }

    @Test
    @DisplayName("probabilities are between 0 and 1 and less sure on ambiguous input")
    void probabilities() {
        var m = trained();
        double sure = m.predict(TransactionFeatures.of("City Power", "electricity bill", BigDecimal.valueOf(120), "EXPENSE")).get().probability();
        double unsure = m.predict(TransactionFeatures.of("", "coffee bill", null, null)).get().probability();
        assertThat(sure).isBetween(0.0, 1.0);
        assertThat(unsure).isLessThan(sure);
    }

    @Test
    @DisplayName("features: merchant, words without store numbers, amount magnitude, type")
    void features() {
        assertThat(TransactionFeatures.of("Starbucks #1234", "Latte 2x", BigDecimal.valueOf(-5.5), "EXPENSE"))
                .contains("merchant:starbucks", "w:starbucks", "w:latte", "amt:0", "type:expense")
                .doesNotContain("w:1234");
    }
}
