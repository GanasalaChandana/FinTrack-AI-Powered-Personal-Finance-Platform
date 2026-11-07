package com.fintrack.households;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HouseholdInviteRepository extends JpaRepository<HouseholdInvite, UUID> {
    Optional<HouseholdInvite> findByTokenHash(String tokenHash);
    List<HouseholdInvite> findByHouseholdIdAndAcceptedFalse(UUID householdId);
    Optional<HouseholdInvite> findByIdAndHouseholdId(UUID id, UUID householdId);
}
