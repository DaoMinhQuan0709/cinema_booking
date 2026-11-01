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
 * Quyen: Customer (Authenticated) / Admin
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
     * Real-time: Broadcast WebSocket HOLD toi client.
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

    /**
     * DELETE /api/v1/bookings/{bookingCode}/cancel - Huy giu cho chu dong (Cong viec 4.2).
     * Chuyen Booking sang CANCELLED, nha ghe DB ve AVAILABLE, xoa key Redis, broadcast WebSocket RELEASE.
     */
    @DeleteMapping("/{bookingCode}/cancel")
    public ResponseEntity<ApiResponse<BookingResponse>> cancelBooking(
            @PathVariable String bookingCode,
            @AuthenticationPrincipal UserDetails userDetails) {

        log.info("DELETE /api/v1/bookings/{}/cancel - user={}", bookingCode, userDetails.getUsername());

        BookingResponse response = bookingService.cancelBooking(bookingCode, userDetails.getUsername());

        return ResponseEntity.ok(ApiResponse.success(200, "Huy giu cho thanh cong", response));
    }
}