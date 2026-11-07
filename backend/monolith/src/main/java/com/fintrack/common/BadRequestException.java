package com.fintrack.common;

/** Invalid input, with a message written by our own code that is safe to show the user. */
public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }
}
