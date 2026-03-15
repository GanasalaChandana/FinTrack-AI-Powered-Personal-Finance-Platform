package com.fintrack.reports.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ReportsErrorResponse {

    private String error;

    private String message;

    private Integer status;

    private String path;

    private LocalDateTime timestamp;

    private List<String> details;

    public ReportsErrorResponse(String error, String message, Integer status, String path) {
        this.error = error;
        this.message = message;
        this.status = status;
        this.path = path;
        this.timestamp = LocalDateTime.now();
    }
}
