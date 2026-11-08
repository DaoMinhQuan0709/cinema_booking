package com.cinema.booking.controller;

import com.cinema.booking.dto.response.ApiResponse;
import com.cinema.booking.dto.response.GalaxySyncResponse;
import com.cinema.booking.dto.response.GalaxySyncStatusResponse;
import com.cinema.booking.service.GalaxySyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/sync")
@RequiredArgsConstructor
public class AdminDataSyncController {

    private final GalaxySyncService galaxySyncService;

    /**
     * Online sync. 0 imports the complete snapshot; clientId defaults to server configuration.
     */
    @PostMapping("/galaxy")
    public ResponseEntity<ApiResponse<GalaxySyncResponse>> syncGalaxy(
            @RequestParam(required = false) String clientId,
            @RequestParam(defaultValue = "0") int limitShowtimes) {
        GalaxySyncResponse response = galaxySyncService.syncGalaxyData(clientId, limitShowtimes);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/galaxy/status")
    public ResponseEntity<ApiResponse<GalaxySyncStatusResponse>> getGalaxySyncStatus() {
        return ResponseEntity.ok(ApiResponse.success(galaxySyncService.getStatus()));
    }

    /**
     * Cach 2: Dong bo Offline tu file JSON local (Khong can mang, khong so bi chan Client ID).
     */
    @PostMapping("/galaxy/local-file")
    public ResponseEntity<ApiResponse<GalaxySyncResponse>> syncFromLocalFile(
            @RequestParam(defaultValue = "100") int limitShowtimes) {
        GalaxySyncResponse response = galaxySyncService.syncFromLocalFile(limitShowtimes);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * Cach 3: Paste truc tiep JSON tu Galaxy Cinema vao Request Body.
     */
    @PostMapping("/galaxy/raw-json")
    public ResponseEntity<ApiResponse<GalaxySyncResponse>> syncFromRawJson(
            @RequestBody String rawJson,
            @RequestParam(defaultValue = "100") int limitShowtimes) {
        GalaxySyncResponse response = galaxySyncService.syncFromLocalJson(rawJson, limitShowtimes);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
