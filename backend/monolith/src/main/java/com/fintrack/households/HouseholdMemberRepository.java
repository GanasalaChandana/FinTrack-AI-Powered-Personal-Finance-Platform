package com.fintrack.households;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface HouseholdMemberRepository extends JpaRepository<HouseholdMember, String> {
    List<HouseholdMember> findByHouseholdId(UUID householdId);
}
