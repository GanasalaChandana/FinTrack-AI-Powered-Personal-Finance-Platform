package com.fintrack.auth.service;

import com.fintrack.auth.entity.User;
import com.fintrack.auth.enums.Role;
import com.fintrack.auth.repository.UserRepository;
import com.fintrack.auth.security.JwtUtil;
import com.fintrack.budgets.repository.BudgetRepository;
import com.fintrack.budgets.repository.GoalRepository;
import com.fintrack.transactions.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("DemoService")
class DemoServiceTest {

    @Mock private UserRepository        userRepository;
    @Mock private TransactionRepository transactionRepository;
    @Mock private BudgetRepository      budgetRepository;
    @Mock private GoalRepository        goalRepository;
    @Mock private DataWipeService       dataWipeService;
    @Mock private PasswordEncoder       passwordEncoder;
    @Mock private JwtUtil               jwtUtil;

    @InjectMocks
    private DemoService demoService;

    @BeforeEach
    void setUp() {
        User demo = User.builder()
                .id(UUID.randomUUID())
                .email("demo@fintrack.app")
                .role(Role.USER)
                .build();
        when(userRepository.findByEmail("demo@fintrack.app")).thenReturn(Optional.of(demo));
        when(jwtUtil.generateToken(any(User.class))).thenReturn("token");
    }

    @Test
    @DisplayName("repeated demo logins don't wipe and re-seed the shared data each time")
    void repeatedLogins_reseedOnce() {
        demoService.loginAsDemo();
        demoService.loginAsDemo();
        demoService.loginAsDemo();

        verify(dataWipeService, times(1)).wipeAllUserData(anyString());
        verify(transactionRepository, times(1)).saveAll(anyList());
    }

    @Test
    @DisplayName("a failed seed is retried on the next login")
    void failedSeed_retried() {
        doThrow(new RuntimeException("db down")).doNothing()
                .when(dataWipeService).wipeAllUserData(anyString());

        try { demoService.loginAsDemo(); } catch (RuntimeException ignored) { }
        demoService.loginAsDemo();

        verify(dataWipeService, times(2)).wipeAllUserData(anyString());
    }
}
