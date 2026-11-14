package com.fintrack.investments;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** An investment holding: entered by hand (priced from market quotes) or imported from a brokerage. */
@Entity
@Table(name = "holdings")
@Getter
@Setter
@NoArgsConstructor
public class Holding {

    public enum AssetType { STOCK, ETF, FUND, CRYPTO, BOND, CASH, OTHER }
    public enum Source { MANUAL, PLAID }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(length = 20)
    private String symbol;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "asset_type", nullable = false, length = 20)
    private AssetType assetType = AssetType.STOCK;

    @Column(nullable = false, precision = 24, scale = 8)
    private BigDecimal quantity;

    /** Total amount paid for the whole position */
    @Column(name = "cost_basis", precision = 15, scale = 2)
    private BigDecimal costBasis;

    @Column(name = "last_price", precision = 18, scale = 6)
    private BigDecimal lastPrice;

    @Column(name = "price_updated_at")
    private LocalDateTime priceUpdatedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Source source = Source.MANUAL;

    @Column(name = "plaid_item_id")
    private UUID plaidItemId;

    @Column(name = "external_id")
    private String externalId;

    @Column(name = "account_name")
    private String accountName;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
