package com.cinema.booking.controller;

import com.cinema.booking.dto.request.MovieCreateRequest;
import com.cinema.booking.dto.response.ApiResponse;
import com.cinema.booking.dto.response.MovieResponse;
import com.cinema.booking.service.AdminCatalogService;
import com.cinema.booking.service.AdminDeletionService;
import com.cinema.booking.dto.response.DeletionPreviewResponse;
import java.security.Principal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/movies")
@RequiredArgsConstructor
public class AdminMovieController {

    private final AdminCatalogService adminCatalogService;
    private final AdminDeletionService deletion;

    @PostMapping
    public ResponseEntity<ApiResponse<MovieResponse>> createMovie(@Valid @RequestBody MovieCreateRequest request) {
        MovieResponse response = adminCatalogService.createMovie(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<MovieResponse>> updateMovie(
            @PathVariable Long id,
            @Valid @RequestBody MovieCreateRequest request) {
        MovieResponse response = adminCatalogService.updateMovie(id, request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<DeletionPreviewResponse>> deleteMovie(@PathVariable Long id,
            @RequestHeader(value = "If-Match", required = false) String token, Principal principal) {
        return ResponseEntity.ok(ApiResponse.success(200, "Đã xóa phim khỏi danh sách hoạt động.", deletion.delete("movies", id, token, principal.getName())));
    }

    @GetMapping("/{id}/deletion-preview")
    public ResponseEntity<ApiResponse<DeletionPreviewResponse>> preview(@PathVariable Long id, Principal principal) {
        return ResponseEntity.ok(ApiResponse.success(deletion.preview("movies", id, principal.getName())));
    }
}

