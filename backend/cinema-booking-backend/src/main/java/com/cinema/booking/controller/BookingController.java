package com.cinema.booking.controller;

import com.cinema.booking.dto.request.BookingCreateRequest;
import com.cinema.booking.dto.response.ApiResponse;
import com.cinema.booking.dto.response.BookingResponse;
import com.cinema.booking.service.BookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * REST Controller cho module Booking.
 * Base path: /api/v1/bookings
 * Quyen: Customer (Authenticated)
 */
@RestController
@RequestMapping("/api/v1/bookings")
@RequiredArgsConstructor
@Slf4j
public class BookingController {

    private final BookingService bookingService;

    /**
     * POST /api/v1/bookings - Tao don dat ve moi (Giu ghe 10 phut).
     * Co che Two-Layer Locking: Redis Fast-Fail + PostgreSQL FOR UPDATE NOWAIT.
     *
     * Request Body:
     * {
     *   "showtimeId": 1,
     *   "showtimeSeatIds": [10, 11, 12],
     *   "products": [
     *     { "productId": 1, "quantity": 2 },
     *     { "productId": 3, "quantity": 1 }
     *   ]
     * }
     */
    @PostMapping
    public ResponseEntity<ApiResponse<BookingResponse>> createBooking(
            @Valid @RequestBody BookingCreateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        log.info("POST /api/v1/bookings - user={}, showtimeId={}, seats={}",
                userDetails.getUsername(), request.getShowtimeId(), request.getShowtimeSeatIds());

        BookingResponse response = bookingService.createBooking(request, userDetails.getUsername());

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success(201, "Giu ghe thanh cong! Ban co 10 phut de thanh toan.", response));
    }

    /**
     * GET /api/v1/bookings/{bookingCode} - Xem chi tiet don dat ve.
     */
    @GetMapping("/{bookingCode}")
    public ResponseEntity<ApiResponse<BookingResponse>> getBooking(
            @PathVariable String bookingCode,
            @AuthenticationPrincipal UserDetails userDetails) {

        log.info("GET /api/v1/bookings/{} - user={}", bookingCode, userDetails.getUsername());

        BookingResponse response = bookingService.getBookingByCode(bookingCode, userDetails.getUsername());

        return ResponseEntity.ok(ApiResponse.success(200, "Lay chi tiet don dat ve thanh cong", response));
    }
}
