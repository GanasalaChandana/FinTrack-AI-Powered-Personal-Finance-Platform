package com.fintrack.households;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "households")
@Getter
@Setter
@NoArgsConstructor
public class Household {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "owner_id", nullable = false)
    private String ownerId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
