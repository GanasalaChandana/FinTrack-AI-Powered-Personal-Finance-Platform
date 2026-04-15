package com.fintrack.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Catch-all exception handler for any controller not covered by a more specific
 * package-scoped @RestControllerAdvice (e.g. BudgetExceptionHandler).
 *
 * Order(10) — lower priority than domain-specific handlers (Order(1)).
 */
@RestControllerAdvice
@Order(10)
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntimeException(RuntimeException ex) {
        log.error("Unhandled RuntimeException: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                        "status",    500,
                        "error",     "Internal Server Error",
                        "message",   ex.getMessage() != null ? ex.getMessage() : "An unexpected error occurred",
                        "timestamp", LocalDateTime.now().toString()
                ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception ex) {
        log.error("Unhandled Exception: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                        "status",    500,
                        "error",     "Internal Server Error",
                        "message",   ex.getMessage() != null ? ex.getMessage() : "An unexpected error occurred",
                        "timestamp", LocalDateTime.now().toString()
                ));
    }
}
