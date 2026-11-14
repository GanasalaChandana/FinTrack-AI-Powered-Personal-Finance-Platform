package com.fintrack.plaid;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** One account inside a connected bank, with its latest balance (for net worth). */
@Entity
@Table(name = "plaid_accounts")
@Getter
@Setter
@NoArgsConstructor
public class PlaidAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "plaid_item_id", nullable = false)
    private UUID plaidItemId;

    @Column(name = "account_id", nullable = false)
    private String accountId;

    private String name;

    @Column(length = 10)
    private String mask;

    /** depository, credit, loan, investment, other */
    @Column(length = 30)
    private String type;

    @Column(length = 50)
    private String subtype;

    @Column(name = "current_balance", precision = 15, scale = 2)
    private BigDecimal currentBalance;

    @Column(length = 3)
    private String currency;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /** Credit cards and loans are money owed. */
    public boolean isLiability() {
        return "credit".equals(type) || "loan".equals(type);
    }
}
