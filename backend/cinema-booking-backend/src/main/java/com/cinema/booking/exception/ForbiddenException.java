package com.cinema.booking.exception;

public class ForbiddenException extends AppException {

    public ForbiddenException(String message) {
        super(403, message);
    }
}