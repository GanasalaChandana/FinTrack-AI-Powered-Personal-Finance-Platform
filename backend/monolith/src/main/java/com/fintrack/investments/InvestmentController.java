package com.fintrack.investments;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Holdings and net worth. The user id comes from the verified session (X-User-Id set by the JWT filter). */
@RestController
@RequiredArgsConstructor
public class InvestmentController {

    private final InvestmentService investments;

    @GetMapping("/api/investments")
    public InvestmentService.Portfolio portfolio(@RequestHeader("X-User-Id") String userId) {
        return investments.portfolio(userId);
    }

    @PostMapping("/api/investments")
    public ResponseEntity<InvestmentService.HoldingView> create(@RequestHeader("X-User-Id") String userId,
                                                               @RequestBody InvestmentService.HoldingRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(investments.create(userId, body));
    }

    @PutMapping("/api/investments/{id}")
    public InvestmentService.HoldingView update(@RequestHeader("X-User-Id") String userId, @PathVariable UUID id,
                                                @RequestBody InvestmentService.HoldingRequest body) {
        return investments.update(userId, id, body);
    }

    @DeleteMapping("/api/investments/{id}")
    public ResponseEntity<Void> delete(@RequestHeader("X-User-Id") String userId, @PathVariable UUID id) {
        investments.delete(userId, id);
        return ResponseEntity.noContent().build();
    }

    /** Current price and name for a symbol, to fill in the add-holding form. */
    @GetMapping("/api/investments/quote")
    public ResponseEntity<QuoteService.Quote> quote(@RequestParam String symbol,
                                                    @RequestParam(defaultValue = "STOCK") String type) {
        QuoteService.Quote q = investments.lookup(symbol, type);
        return q == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(q);
    }

    /** Balances of connected accounts and the value of investments, for the Net Worth page. */
    @GetMapping("/api/net-worth/linked")
    public InvestmentService.LinkedNetWorth linked(@RequestHeader("X-User-Id") String userId) {
        return investments.linkedNetWorth(userId);
    }
}
