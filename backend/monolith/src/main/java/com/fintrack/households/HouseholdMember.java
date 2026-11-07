package com.fintrack.households;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/** Membership; a user is in at most one household (user_id is the key). */
@Entity
@Table(name = "household_members")
@Getter
@Setter
@NoArgsConstructor
public class HouseholdMember {
    public enum Role { OWNER, MEMBER }

    @Id
    @Column(name = "user_id")
    private String userId;

    @Column(name = "household_id", nullable = false)
    private UUID householdId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(name = "joined_at", nullable = false)
    private LocalDateTime joinedAt;
}
