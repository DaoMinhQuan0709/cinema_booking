package com.cinema.booking.service;

import com.cinema.booking.dto.request.LoginRequest;
import com.cinema.booking.dto.request.RefreshTokenRequest;
import com.cinema.booking.dto.request.RegisterRequest;
import com.cinema.booking.dto.response.AuthResponse;

public interface AuthService {

    AuthResponse register(RegisterRequest request);

    AuthResponse login(LoginRequest request);

    AuthResponse refreshToken(RefreshTokenRequest request);
}