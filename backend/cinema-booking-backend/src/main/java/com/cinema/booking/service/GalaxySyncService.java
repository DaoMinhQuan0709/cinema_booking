package com.cinema.booking.service;

import com.cinema.booking.dto.response.GalaxySyncResponse;

public interface GalaxySyncService {

    GalaxySyncResponse syncGalaxyData(String clientId, int limitShowtimes);

    GalaxySyncResponse syncFromLocalJson(String jsonContent, int limitShowtimes);

    GalaxySyncResponse syncFromLocalFile(int limitShowtimes);
}

