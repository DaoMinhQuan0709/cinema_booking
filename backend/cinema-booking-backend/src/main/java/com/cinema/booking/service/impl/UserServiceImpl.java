package com.cinema.booking.service.impl;

import com.cinema.booking.dto.response.BookingHistoryResponse;
import com.cinema.booking.dto.response.UserResponse;
import com.cinema.booking.entity.Booking;
import com.cinema.booking.entity.User;
import com.cinema.booking.exception.ResourceNotFoundException;
import com.cinema.booking.repository.BookingRepository;
import com.cinema.booking.repository.UserRepository;
import com.cinema.booking.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;

    @Override
    @Transactional(readOnly = true)
    public UserResponse getCurrentUserProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin người dùng với email: " + email));

        return UserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .role(user.getRole())
                .createdAt(user.getCreatedAt())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingHistoryResponse> getCurrentUserBookings(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin người dùng"));

        List<Booking> bookings = bookingRepository.findByUserIdOrderByCreatedAtDesc(user.getId());

        return bookings.stream().map(b -> BookingHistoryResponse.builder()
                .id(b.getId())
                .bookingCode(b.getBookingCode())
                .movieTitle(b.getShowtime() != null && b.getShowtime().getMovie() != null ? b.getShowtime().getMovie().getTitle() : null)
                .cinemaName(b.getShowtime() != null && b.getShowtime().getAuditorium() != null && b.getShowtime().getAuditorium().getCinema() != null ? b.getShowtime().getAuditorium().getCinema().getName() : null)
                .auditoriumName(b.getShowtime() != null && b.getShowtime().getAuditorium() != null ? b.getShowtime().getAuditorium().getName() : null)
                .showStartTime(b.getShowtime() != null ? b.getShowtime().getStartTime() : null)
                .totalAmount(b.getTotalAmount())
                .status(b.getStatus())
                .qrCodeUrl(b.getQrCodeUrl())
                .createdAt(b.getCreatedAt())
                .expiresAt(b.getExpiresAt())
                .build()
        ).collect(Collectors.toList());
    }
}