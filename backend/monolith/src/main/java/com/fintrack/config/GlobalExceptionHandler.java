package com.fintrack.config;

import com.fintrack.budgets.exception.ResourceNotFoundException;
import com.fintrack.budgets.exception.UnauthorizedException;
import com.fintrack.notifications.exception.NotificationNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The single exception handler for the whole API.
 *
 * Client mistakes get their real status (400/403/404/405…) with a safe message;
 * anything unexpected is logged in full and returned as a generic 500 — exception
 * messages can contain SQL, table names or hostnames, so they never reach the client.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    // ── 404 ──────────────────────────────────────────────────────────────────
    @ExceptionHandler({ResourceNotFoundException.class, NotificationNotFoundException.class})
    public ResponseEntity<Map<String, Object>> handleNotFound(RuntimeException ex) {
        // These messages are written by our own code ("Transaction not found")
        return body(HttpStatus.NOT_FOUND, ex.getMessage(), null);
    }

    // ── 403 ──────────────────────────────────────────────────────────────────
    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<Map<String, Object>> handleForbidden(UnauthorizedException ex) {
        return body(HttpStatus.FORBIDDEN, ex.getMessage(), null);
    }

    // ── 400: bad input ───────────────────────────────────────────────────────
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new LinkedHashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String field = error instanceof FieldError fe ? fe.getField() : error.getObjectName();
            errors.put(field, error.getDefaultMessage());
        });
        // Show the actual problem when there's one ("Password must be at least 8 characters")
        String message = errors.size() == 1 ? errors.values().iterator().next() : "Validation failed";
        return body(HttpStatus.BAD_REQUEST, message, errors);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadable(HttpMessageNotReadableException ex) {
        return body(HttpStatus.BAD_REQUEST, "Malformed request body", null);
    }

    @ExceptionHandler({MissingServletRequestParameterException.class,
                       MissingRequestHeaderException.class,
                       MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String, Object>> handleBadParameter(Exception ex) {
        return body(HttpStatus.BAD_REQUEST, "Invalid or missing request parameter", null);
    }

    // ── everything else ──────────────────────────────────────────────────────
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception ex) {
        // Spring's own errors (unknown URL → 404, wrong method → 405, …) carry
        // their status; keep it instead of turning them into a 500.
        if (ex instanceof ErrorResponse er) {
            HttpStatusCode status = er.getStatusCode();
            HttpStatus known = HttpStatus.resolve(status.value());
            return body(status, known != null ? known.getReasonPhrase() : "Request failed", null);
        }
        log.error("Unhandled exception: {}", ex.getMessage(), ex);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred", null);
    }

    private static ResponseEntity<Map<String, Object>> body(HttpStatusCode status, String message,
                                                            Map<String, String> errors) {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("status", status.value());
        HttpStatus known = HttpStatus.resolve(status.value());
        b.put("error", known != null ? known.getReasonPhrase() : "Error");
        b.put("message", message);
        if (errors != null) b.put("errors", errors);
        b.put("timestamp", LocalDateTime.now().toString());
        return ResponseEntity.status(status).body(b);
    }
}
