package com.fintrack.auth.security;

import com.fintrack.auth.service.DemoService;

/**
 * The demo account is shared by every visitor, so account-level changes (profile,
 * password, 2-factor, deleting the account, households, push) are
 * refused there. Transactions, budgets and goals stay editable.
 */
public final class DemoGuard {
    private DemoGuard() {}

    public static final String MESSAGE =
            "The demo account is shared, so account settings can't be changed. Create a free account to try this.";

    public static boolean isDemo(String email) {
        return email != null && DemoService.DEMO_EMAIL.equalsIgnoreCase(email);
    }

    public static boolean blocked(String method, String path) {
        if (method == null || path == null || "GET".equalsIgnoreCase(method)) return false;
        return path.equals("/api/users/profile")
                || path.equals("/api/users/me")
                || path.equals("/api/users/change-password")
                || path.startsWith("/api/users/me/2fa")
                || path.startsWith("/api/households")
                || path.startsWith("/api/push/subscriptions") && "POST".equalsIgnoreCase(method);
    }
}
