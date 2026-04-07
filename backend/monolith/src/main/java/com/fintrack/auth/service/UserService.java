package com.fintrack.auth.service;

import com.fintrack.auth.entity.User;
import com.fintrack.auth.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class UserService implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /**
     * Implementation of UserDetailsService for Spring Security
     * This method is called during authentication to load user details
     */
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // Find user by email (username in our case is email)
        User user = userRepository.findByEmail(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + username));

        // Convert our User entity to Spring Security's UserDetails
        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPassword(),
                new ArrayList<>() // Add authorities/roles here if you have them
        // Example with roles:
        // user.getRoles().stream()
        // .map(role -> new SimpleGrantedAuthority(role.getName()))
        // .collect(Collectors.toList())
        );
    }

    // Existing methods below

    public List<User> findAll() {
        return userRepository.findAll();
    }

    public Optional<User> findById(UUID id) {
        return userRepository.findById(id);
    }

    // Add overload for String ID (converts to UUID)
    public Optional<User> findById(String id) {
        try {
            return userRepository.findById(UUID.fromString(id));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public boolean existsByEmail(String email) {
        return userRepository.existsByEmail(email);
    }

    public User save(User user) {
        return userRepository.save(user);
    }

    public void deleteById(UUID id) {
        userRepository.deleteById(id);
    }

    public boolean checkPassword(User user, String rawPassword) {
        return passwordEncoder.matches(rawPassword, user.getPasswordHash());
    }

    public void updatePassword(User user, String newRawPassword) {
        user.setPasswordHash(passwordEncoder.encode(newRawPassword));
        userRepository.save(user);
    }

    // Add overload for String ID (converts to UUID)
    public void deleteById(String id) {
        try {
            userRepository.deleteById(UUID.fromString(id));
        } catch (IllegalArgumentException e) {
            // Handle invalid UUID - could log this
            throw new IllegalArgumentException("Invalid UUID format: " + id);
        }
    }
}
