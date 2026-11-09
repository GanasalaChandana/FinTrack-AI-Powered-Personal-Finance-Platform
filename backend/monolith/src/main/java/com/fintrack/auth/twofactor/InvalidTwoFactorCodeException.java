package com.fintrack.auth.twofactor;

/** The password was right but the two-factor code wasn't. */
public class InvalidTwoFactorCodeException extends RuntimeException {
    public InvalidTwoFactorCodeException() { super("Invalid two-factor code"); }
}
