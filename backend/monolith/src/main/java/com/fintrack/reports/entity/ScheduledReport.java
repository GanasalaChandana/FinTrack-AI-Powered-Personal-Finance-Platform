package com.fintrack.reports.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "scheduled_reports")
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ScheduledReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "report_type", nullable = false, length = 50)
    private String reportType;

    @Column(nullable = false, length = 20)
    private String frequency; // DAILY, WEEKLY, MONTHLY

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(length = 20)
    private String format; // PDF, EXCEL, JSON

    @Column(columnDefinition = "TEXT")
    private String categories; // JSON array stored as text

    @Column(name = "delivery_method", length = 20)
    private String deliveryMethod; // EMAIL, DOWNLOAD

    @Column(name = "delivery_email")
    private String deliveryEmail;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "last_run")
    private LocalDateTime lastRun;

    @Column(name = "next_run")
    private LocalDateTime nextRun;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
