package com.fintrack.common;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class MoneyTest {
    @Test
    void formatsInTheUsersCurrency() {
        assertThat(Money.format(new BigDecimal("1234.5"), "USD")).isEqualTo("$1,234.50");
        assertThat(Money.format(new BigDecimal("-12"), "EUR")).isEqualTo("€12.00");
        assertThat(Money.format(new BigDecimal("3"), "GBP")).isEqualTo("£3.00");
        assertThat(Money.format(new BigDecimal("3"), "INR")).isEqualTo("₹3.00");
        assertThat(Money.format(new BigDecimal("3"), null)).isEqualTo("$3.00");
        assertThat(Money.format(new BigDecimal("3"), "XYZ")).isEqualTo("3.00");
    }
}
