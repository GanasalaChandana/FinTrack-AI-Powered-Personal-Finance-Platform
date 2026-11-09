package com.fintrack.auth.twofactor;

/** The password was right, but the account also needs a code from the authenticator app. */
public class TwoFactorRequiredException extends RuntimeException {
    public TwoFactorRequiredException() { super("Two-factor code required"); }
}
