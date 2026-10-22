package com.cinema.booking.exception;

public class SeatConflictException extends ConflictException {

    public SeatConflictException(String message) {
        super(message);
    }

    public SeatConflictException() {
        super("Ghế bạn chọn đã có người nhanh tay hơn giữ chỗ. Vui lòng chọn ghế khác.");
    }
}