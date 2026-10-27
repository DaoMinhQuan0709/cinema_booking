package com.cinema.booking.controller;

import com.cinema.booking.dto.response.ApiResponse;
import com.cinema.booking.dto.response.ShowtimeResponse;
import com.cinema.booking.dto.response.ShowtimeSeatsMapResponse;
import com.cinema.booking.service.ShowtimeService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/showtimes")
@RequiredArgsConstructor
public class ShowtimeController {

    private final ShowtimeService showtimeService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ShowtimeResponse>>> getShowtimes(
            @RequestParam(required = false) Long movieId,
            @RequestParam(required = false) Long cinemaId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {

        List<ShowtimeResponse> response = showtimeService.getShowtimes(movieId, cinemaId, date);
        return ResponseEntity.ok(ApiResponse.success(200, "Lấy danh sách suất chiếu thành công", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ShowtimeResponse>> getShowtimeById(@PathVariable Long id) {
        ShowtimeResponse response = showtimeService.getShowtimeById(id);
        return ResponseEntity.ok(ApiResponse.success(200, "Lấy chi tiết suất chiếu thành công", response));
    }

    @GetMapping("/{id}/seats")
    public ResponseEntity<ApiResponse<ShowtimeSeatsMapResponse>> getShowtimeSeats(@PathVariable Long id) {
        ShowtimeSeatsMapResponse response = showtimeService.getShowtimeSeats(id);
        return ResponseEntity.ok(ApiResponse.success(200, "Lấy sơ đồ ghế và trạng thái real-time thành công", response));
    }
}