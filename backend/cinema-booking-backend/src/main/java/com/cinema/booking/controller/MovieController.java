package com.cinema.booking.controller;

import com.cinema.booking.dto.response.ApiResponse;
import com.cinema.booking.dto.response.MovieResponse;
import com.cinema.booking.dto.response.PageResponse;
import com.cinema.booking.enums.MovieStatus;
import com.cinema.booking.service.MovieService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/movies")
@RequiredArgsConstructor
public class MovieController {

    private final MovieService movieService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<MovieResponse>>> getMovies(
            @RequestParam(required = false) MovieStatus status,
            @RequestParam(required = false) String genre,
            @RequestParam(required = false) String keyword,
            @PageableDefault(page = 0, size = 10, sort = "releaseDate", direction = Sort.Direction.DESC) Pageable pageable) {

        PageResponse<MovieResponse> response = movieService.getMovies(status, genre, keyword, pageable);
        return ResponseEntity.ok(ApiResponse.success(200, "Lấy danh sách phim thành công", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MovieResponse>> getMovieById(@PathVariable Long id) {
        MovieResponse response = movieService.getMovieById(id);
        return ResponseEntity.ok(ApiResponse.success(200, "Lấy chi tiết phim thành công", response));
    }
}