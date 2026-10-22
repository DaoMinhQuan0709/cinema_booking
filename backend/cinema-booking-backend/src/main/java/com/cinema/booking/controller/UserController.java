package com.cinema.booking.controller;

import com.cinema.booking.dto.response.ApiResponse;
import com.cinema.booking.dto.response.BookingHistoryResponse;
import com.cinema.booking.dto.response.UserResponse;
import com.cinema.booking.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> getCurrentUser(@AuthenticationPrincipal UserDetails userDetails) {
        UserResponse response = userService.getCurrentUserProfile(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(200, "Lấy thông tin cá nhân thành công", response));
    }

    @GetMapping("/me/bookings")
    public ResponseEntity<ApiResponse<List<BookingHistoryResponse>>> getCurrentUserBookings(@AuthenticationPrincipal UserDetails userDetails) {
        List<BookingHistoryResponse> bookings = userService.getCurrentUserBookings(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(200, "Lấy lịch sử đặt vé thành công", bookings));
    }
}