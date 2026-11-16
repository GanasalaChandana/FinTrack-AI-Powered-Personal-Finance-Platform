package com.fintrack.investments;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Market prices for hand-entered holdings, from Yahoo Finance's public chart endpoint
 * (stocks, ETFs, mutual funds; crypto as e.g. BTC-USD). Quotes are cached for 15
 * minutes so a page of holdings doesn't hammer it; a failed lookup returns null and
 * the holding keeps its last known price.
 */
@Service
@Slf4j
public class QuoteService {

    public record Quote(String symbol, BigDecimal price, String currency, String name) {}

    private static final Duration TTL = Duration.ofMinutes(15);
    private record Cached(Quote quote, Instant at) {}

    private final RestClient http;
    private final ObjectMapper json;
    private final String baseUrl;
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();

    public QuoteService(ObjectMapper json, @Value("${quotes.base-url:https://query1.finance.yahoo.com}") String baseUrl) {
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(5000);
        f.setReadTimeout(8000);
        this.http = RestClient.builder().requestFactory(f).build();
        this.json = json;
        this.baseUrl = baseUrl.replaceAll("/$", "");
    }

    /** The symbol as the quote source knows it: crypto "BTC" becomes "BTC-USD". */
    public static String marketSymbol(String symbol, Holding.AssetType type) {
        if (symbol == null || symbol.isBlank()) return null;
        String s = symbol.trim().toUpperCase(Locale.ROOT);
        if (type == Holding.AssetType.CRYPTO && !s.contains("-")) s = s + "-USD";
        return s.matches("[A-Z0-9.\\-^=]{1,20}") ? s : null;
    }

    public Quote quote(String symbol, Holding.AssetType type) {
        String s = marketSymbol(symbol, type);
        if (s == null) return null;
        Cached c = cache.get(s);
        if (c != null && c.at().plus(TTL).isAfter(Instant.now())) return c.quote();
        try {
            String body = http.get().uri(baseUrl + "/v8/finance/chart/" + s + "?range=1d&interval=1d")
                    .header("User-Agent", "Mozilla/5.0 (FinTrack)")
                    .retrieve().body(String.class);
            JsonNode meta = json.readTree(body == null ? "{}" : body).path("chart").path("result").path(0).path("meta");
            if (!meta.has("regularMarketPrice")) return null;
            String name = meta.path("longName").asText(meta.path("shortName").asText(s));
            Quote q = new Quote(s, new BigDecimal(meta.path("regularMarketPrice").asText()),
                    meta.path("currency").asText("USD"), name);
            cache.put(s, new Cached(q, Instant.now()));
            return q;
        } catch (Exception e) {
            log.debug("No quote for {}: {}", s, e.getMessage());
            return null;
        }
    }

    // ── price history ─────────────────────────────────────────────────────────

    public record PricePoint(java.time.LocalDate date, BigDecimal close) {}

    private static final Duration HISTORY_TTL = Duration.ofHours(6);
    private record CachedHistory(java.util.List<PricePoint> points, Instant at) {}
    private final Map<String, CachedHistory> historyCache = new ConcurrentHashMap<>();

    /** Yahoo's range and bar size for our ranges: daily bars up to 6 months, weekly for a year. */
    static String[] yahooRange(String range) {
        return switch (range == null ? "" : range) {
            case "1m" -> new String[] { "1mo", "1d" };
            case "1y" -> new String[] { "1y", "1wk" };
            default -> new String[] { "6mo", "1d" };
        };
    }

    /** Closing prices, oldest first; empty when the symbol has no history. Cached for 6 hours. */
    public java.util.List<PricePoint> history(String symbol, Holding.AssetType type, String range) {
        String s = marketSymbol(symbol, type);
        if (s == null) return java.util.List.of();
        String[] yr = yahooRange(range);
        String key = s + "|" + yr[0];
        CachedHistory c = historyCache.get(key);
        if (c != null && c.at().plus(HISTORY_TTL).isAfter(Instant.now())) return c.points();
        try {
            String body = http.get().uri(baseUrl + "/v8/finance/chart/" + s + "?range=" + yr[0] + "&interval=" + yr[1])
                    .header("User-Agent", "Mozilla/5.0 (FinTrack)")
                    .retrieve().body(String.class);
            JsonNode r = json.readTree(body == null ? "{}" : body).path("chart").path("result").path(0);
            JsonNode ts = r.path("timestamp"), closes = r.path("indicators").path("quote").path(0).path("close");
            java.util.List<PricePoint> out = new java.util.ArrayList<>();
            for (int i = 0; i < ts.size() && i < closes.size(); i++) {
                if (closes.get(i).isNull()) continue; // a day with no trade
                out.add(new PricePoint(
                        Instant.ofEpochSecond(ts.get(i).asLong()).atZone(java.time.ZoneOffset.UTC).toLocalDate(),
                        new BigDecimal(closes.get(i).asText())));
            }
            historyCache.put(key, new CachedHistory(out, Instant.now()));
            return out;
        } catch (Exception e) {
            log.debug("No history for {}: {}", s, e.getMessage());
            return java.util.List.of();
        }
    }
}
