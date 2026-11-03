package com.fintrack.transactions.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** A category the user chose for a merchant; applied to that merchant's future transactions. */
@Entity
@Table(name = "category_rules")
@Data
@NoArgsConstructor
public class CategoryRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "merchant_key", nullable = false)
    private String merchantKey;

    @Column(nullable = false, length = 100)
    private String category;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
