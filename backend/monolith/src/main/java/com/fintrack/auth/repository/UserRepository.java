package com.fintrack.auth.repository;

import com.fintrack.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByUsername(String username);

    /**
     * Usernames are unique, but the natural choice (the email prefix) often
     * isn't: john@gmail.com and john@yahoo.com. Returns the requested name, or
     * the email prefix, with a short random suffix if it's already taken.
     */
    default String uniqueUsername(String requested, String email) {
        String base = (requested == null || requested.isBlank()) ? email.split("@")[0] : requested.trim();
        base = base.length() > 90 ? base.substring(0, 90) : base;
        if (!existsByUsername(base)) return base;
        for (int i = 0; i < 5; i++) {
            String candidate = base + "-" + java.util.UUID.randomUUID().toString().substring(0, 6);
            if (!existsByUsername(candidate)) return candidate;
        }
        return base + "-" + java.util.UUID.randomUUID();
    }

}
