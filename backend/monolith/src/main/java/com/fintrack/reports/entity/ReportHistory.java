package com.fintrack.reports.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Data
@Table(name = "report_history")
public class ReportHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    @JdbcTypeCode(SqlTypes.UUID)
    private UUID userId;

    @Column(name = "report_type", nullable = false)
    private String reportType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReportStatus status;

    @Column(name = "generated_at", nullable = false)
    private LocalDateTime generatedAt;

    public enum ReportStatus {
        PENDING, PROCESSING, COMPLETED, FAILED
    }
}
