package com.cinema.booking.controller;

import com.cinema.booking.dto.request.ShowtimeCreateRequest;
import com.cinema.booking.dto.response.ApiResponse;
import com.cinema.booking.dto.response.ShowtimeResponse;
import com.cinema.booking.service.AdminCatalogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/showtimes")
@RequiredArgsConstructor
public class AdminShowtimeController {

    private final AdminCatalogService adminCatalogService;

    @PostMapping
    public ResponseEntity<ApiResponse<ShowtimeResponse>> createShowtime(@Valid @RequestBody ShowtimeCreateRequest request) {
        ShowtimeResponse response = adminCatalogService.createShowtime(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created("Xep lich chieu thanh cong", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteShowtime(@PathVariable Long id) {
        adminCatalogService.deleteShowtime(id);
        return ResponseEntity.ok(ApiResponse.success(200, "Xoa suat chieu thanh cong", null));
    }
}

