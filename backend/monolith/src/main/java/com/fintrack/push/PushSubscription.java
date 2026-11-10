package com.fintrack.push;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** A browser/device that agreed to receive push notifications for a user. */
@Entity
@Table(name = "push_subscriptions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PushSubscription {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    @Column(nullable = false, unique = true, length = 1000)
    private String endpoint;

    /** The browser's public key (base64url) */
    @Column(nullable = false, length = 200)
    private String p256dh;

    /** The browser's auth secret (base64url) */
    @Column(nullable = false, length = 100)
    private String auth;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
