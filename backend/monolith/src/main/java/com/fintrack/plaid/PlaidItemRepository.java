package com.fintrack.plaid;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlaidItemRepository extends JpaRepository<PlaidItem, UUID> {
    List<PlaidItem> findByUserId(String userId);
    Optional<PlaidItem> findByIdAndUserId(UUID id, String userId);
}
