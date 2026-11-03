package com.fintrack.transactions.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/** Progress of one background CSV import (see TransactionImportService). */
@Entity
@Table(name = "import_jobs")
@Data
@NoArgsConstructor
public class ImportJob {

    public enum Status { PENDING, RUNNING, DONE, FAILED }

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;

    @Column(nullable = false)
    private int total;

    @Column(nullable = false)
    private int processed;

    @Column(nullable = false)
    private int imported;

    @Column(nullable = false)
    private int failed;

    @Column(length = 500)
    private String error;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
