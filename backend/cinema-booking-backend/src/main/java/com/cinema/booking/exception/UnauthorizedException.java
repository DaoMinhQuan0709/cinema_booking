package com.cinema.booking.exception;

public class UnauthorizedException extends AppException {

    public UnauthorizedException(String message) {
        super(401, message);
    }
}