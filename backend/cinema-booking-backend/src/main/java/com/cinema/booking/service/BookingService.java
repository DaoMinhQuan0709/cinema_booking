package com.cinema.booking.service;

import com.cinema.booking.dto.request.BookingCreateRequest;
import com.cinema.booking.dto.response.BookingResponse;

/**
 * Service interface cho module Booking.
 * Cung cap cac thao tac: Tao don, Xem chi tiet don, Huy don.
 */
public interface BookingService {

    /**
     * Tao don dat ve moi voi co che Two-Layer Locking.
     * Buoc 1: Sap xep seatIds tang dan (Anti-Deadlock)
     * Buoc 2: Lock Redis (Fast-Fail)
     * Buoc 3: Lock PostgreSQL (FOR UPDATE NOWAIT) + Tao booking
     * Buoc 4: Broadcast WebSocket su kien giu ghe (HOLD)
     *
     * @param request   Thong tin dat ve (showtimeId, seatIds, products)
     * @param userEmail Email nguoi dung (tu JWT token)
     * @return BookingResponse chi tiet don dat ve
     */
    BookingResponse createBooking(BookingCreateRequest request, String userEmail);

    /**
     * Lay chi tiet don dat ve theo bookingCode.
     *
     * @param bookingCode Ma don dat ve (VD: BK20261027123456AB)
     * @param userEmail   Email nguoi dung (kiem tra quyen so huu)
     * @return BookingResponse chi tiet don dat ve
     */
    BookingResponse getBookingByCode(String bookingCode, String userEmail);

    /**
     * Huy don dat ve chu dong (khi don dang o trang thai PENDING).
     * Chuyen Booking sang CANCELLED, nha ghe DB ve AVAILABLE, xoa key Redis, broadcast WebSocket.
     *
     * @param bookingCode Ma don dat ve can huy
     * @param userEmail   Email nguoi dung yeu cau huy (kiem tra quyen)
     * @return BookingResponse chi tiet don dat ve sau khi huy
     */
    BookingResponse cancelBooking(String bookingCode, String userEmail);
}