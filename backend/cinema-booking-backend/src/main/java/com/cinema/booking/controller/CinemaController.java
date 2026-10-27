package com.cinema.booking.controller;

import com.cinema.booking.dto.response.ApiResponse;
import com.cinema.booking.dto.response.CinemaResponse;
import com.cinema.booking.service.CinemaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/cinemas")
@RequiredArgsConstructor
public class CinemaController {

    private final CinemaService cinemaService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<CinemaResponse>>> getCinemas(@RequestParam(required = false) String city) {
        List<CinemaResponse> response = cinemaService.getCinemas(city);
        return ResponseEntity.ok(ApiResponse.success(200, "Lấy danh sách cụm rạp thành công", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<CinemaResponse>> getCinemaById(@PathVariable Long id) {
        CinemaResponse response = cinemaService.getCinemaById(id);
        return ResponseEntity.ok(ApiResponse.success(200, "Lấy chi tiết cụm rạp thành công", response));
    }
}