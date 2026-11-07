package com.fintrack.common;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.util.Currency;
import java.util.Locale;

/** Formats amounts for emails and alerts in the user's currency, e.g. "$1,234.50" or "€12.00". */
public final class Money {
    private Money() {}

    public static String format(BigDecimal v, String currency) {
        String n = new DecimalFormat("#,##0.00").format(v.abs().setScale(2, RoundingMode.HALF_UP));
        return symbol(currency) + n;
    }

    public static String format(double v, String currency) {
        return format(BigDecimal.valueOf(v), currency);
    }

    static String symbol(String currency) {
        try {
            String s = Currency.getInstance(currency == null ? "USD" : currency).getSymbol(Locale.US);
            return s.length() <= 1 ? s : s + " "; // "$", "€", "£"; others like "CA$" or "INR" get a space
        } catch (IllegalArgumentException e) {
            return "";
        }
    }
}
