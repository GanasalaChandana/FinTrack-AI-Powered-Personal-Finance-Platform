package com.fintrack.plaid;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlaidAccountRepository extends JpaRepository<PlaidAccount, UUID> {
    List<PlaidAccount> findByUserId(String userId);
    Optional<PlaidAccount> findByPlaidItemIdAndAccountId(UUID plaidItemId, String accountId);
    void deleteByPlaidItemId(UUID plaidItemId);
}
