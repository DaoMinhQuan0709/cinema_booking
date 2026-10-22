package com.cinema.booking.service;

import com.cinema.booking.dto.response.BookingHistoryResponse;
import com.cinema.booking.dto.response.UserResponse;

import java.util.List;

public interface UserService {

    UserResponse getCurrentUserProfile(String email);

    List<BookingHistoryResponse> getCurrentUserBookings(String email);
}