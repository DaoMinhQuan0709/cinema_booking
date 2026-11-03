package com.cinema.booking.controller;

import com.cinema.booking.dto.request.AuditoriumCreateRequest;
import com.cinema.booking.dto.request.CinemaCreateRequest;
import com.cinema.booking.dto.request.SeatBatchCreateRequest;
import com.cinema.booking.dto.response.ApiResponse;
import com.cinema.booking.dto.response.AuditoriumSummaryResponse;
import com.cinema.booking.dto.response.CinemaResponse;
import com.cinema.booking.service.AdminCatalogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminCinemaController {

    private final AdminCatalogService adminCatalogService;

    @PostMapping("/cinemas")
    public ResponseEntity<ApiResponse<CinemaResponse>> createCinema(@Valid @RequestBody CinemaCreateRequest request) {
        CinemaResponse response = adminCatalogService.createCinema(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(response));
    }

    @PostMapping("/cinemas/{cinemaId}/auditoriums")
    public ResponseEntity<ApiResponse<AuditoriumSummaryResponse>> createAuditorium(
            @PathVariable Long cinemaId,
            @Valid @RequestBody AuditoriumCreateRequest request) {
        AuditoriumSummaryResponse response = adminCatalogService.createAuditorium(cinemaId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(response));
    }

    @PostMapping("/auditoriums/{auditoriumId}/seats/batch")
    public ResponseEntity<ApiResponse<Void>> createSeatsBatch(
            @PathVariable Long auditoriumId,
            @RequestBody SeatBatchCreateRequest request) {
        adminCatalogService.createSeatsBatch(auditoriumId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created("Khoi tao so do ghe thanh cong", null));
    }
}

