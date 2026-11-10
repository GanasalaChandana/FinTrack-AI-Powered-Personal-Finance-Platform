package com.fintrack.plaid;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/** A bank connected through Plaid. */
@Entity
@Table(name = "plaid_items")
@Getter
@Setter
@NoArgsConstructor
public class PlaidItem {

    public enum Status { OK, LOGIN_REQUIRED, ERROR }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "item_id", nullable = false, unique = true)
    private String itemId;

    /** AES-GCM encrypted (see TokenCipher); never sent to the browser. */
    @Column(name = "access_token_enc", nullable = false, length = 1024)
    private String accessTokenEnc;

    @Column(name = "institution_name")
    private String institutionName;

    /** Plaid environment it was made in ("sandbox" / "production"; "" = before modes existed) */
    @Column(name = "environment", nullable = false, length = 20)
    private String environment = "";

    @Column(name = "sync_cursor", columnDefinition = "TEXT")
    private String syncCursor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Status status = Status.OK;

    @Column(name = "last_error", length = 500)
    private String lastError;

    @Column(name = "last_synced_at")
    private LocalDateTime lastSyncedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
