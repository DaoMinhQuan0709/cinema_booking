package com.cinema.booking.service;

import com.cinema.booking.dto.request.CinemaCreateRequest;
import com.cinema.booking.dto.response.CinemaResponse;

import java.util.List;

public interface CinemaService {

    List<CinemaResponse> getCinemas(String city);

    CinemaResponse getCinemaById(Long id);

    CinemaResponse createCinema(CinemaCreateRequest request);
}