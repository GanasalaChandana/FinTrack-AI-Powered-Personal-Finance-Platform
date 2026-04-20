package com.fintrack.auth.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fintrack.auth.enums.Role;
import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Email(message = "Invalid email format")
    @NotBlank(message = "Email is required")
    @Column(unique = true, nullable = false, length = 255)
    private String email;

    @Column(unique = true, length = 100)
    private String username;

    // Password is nullable to support Google OAuth users
    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(name = "first_name", length = 100)
    private String firstName;

    @Column(name = "last_name", length = 100)
    private String lastName;

    // Full name for display purposes
    @Column(length = 255)
    private String name;

    // Google OAuth fields
    @Column(name = "google_id", unique = true, length = 255)
    private String googleId;

    @Column(name = "profile_picture", length = 500)
    private String profilePicture;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Role role = Role.USER;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // Hide password from JSON serialization
    @JsonIgnore
    public String getPasswordHash() {
        return passwordHash;
    }

    // Alias for Spring Security compatibility
    @JsonIgnore
    public String getPassword() {
        return passwordHash;
    }

    // Setter for Spring Security compatibility
    public void setPassword(String password) {
        this.passwordHash = password;
    }

    // Convenience method to check if user is OAuth user
    @Transient
    public boolean isOAuthUser() {
        return googleId != null && !googleId.isEmpty();
    }
}
