package com.cinema.booking.controller;

import com.cinema.booking.dto.request.ShowtimeCreateRequest;
import com.cinema.booking.dto.response.ApiResponse;
import com.cinema.booking.dto.response.ShowtimeResponse;
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
@RequestMapping("/api/v1/admin/showtimes")
@RequiredArgsConstructor
public class AdminShowtimeController {

    private final AdminCatalogService adminCatalogService;
    private final AdminDeletionService deletion;

    @PostMapping
    public ResponseEntity<ApiResponse<ShowtimeResponse>> createShowtime(@Valid @RequestBody ShowtimeCreateRequest request) {
        ShowtimeResponse response = adminCatalogService.createShowtime(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created("Xep lich chieu thanh cong", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<DeletionPreviewResponse>> deleteShowtime(@PathVariable Long id,
            @RequestHeader(value = "If-Match", required = false) String token, Principal principal) {
        return ResponseEntity.ok(ApiResponse.success(200, "Đã xóa suất chiếu khỏi danh sách hoạt động.", deletion.delete("showtimes", id, token, principal.getName())));
    }

    @GetMapping("/{id}/deletion-preview")
    public ResponseEntity<ApiResponse<DeletionPreviewResponse>> preview(@PathVariable Long id, Principal principal) {
        return ResponseEntity.ok(ApiResponse.success(deletion.preview("showtimes", id, principal.getName())));
    }
}

