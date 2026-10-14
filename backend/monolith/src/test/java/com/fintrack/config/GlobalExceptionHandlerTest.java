package com.fintrack.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("GlobalExceptionHandler")
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    @DisplayName("never sends internal exception details to the client")
    void internalDetails_notExposed() {
        var response = handler.handleRuntimeException(
                new RuntimeException("ERROR: relation \"transactions\" does not exist, SQL [select * from ...]"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).containsEntry("message", "An unexpected error occurred");
        assertThat(response.getBody().toString()).doesNotContain("transactions").doesNotContain("SQL");
    }

    @Test
    @DisplayName("checked exceptions get the same generic message")
    void checkedException_generic() throws Exception {
        var response = handler.handleException(new Exception("connection refused: db.internal:5432"));

        assertThat(response.getBody()).containsEntry("message", "An unexpected error occurred");
        assertThat(response.getBody().toString()).doesNotContain("db.internal");
    }
}
