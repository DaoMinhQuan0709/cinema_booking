package com.cinema.booking.service;

import com.cinema.booking.dto.request.ShowtimeCreateRequest;
import com.cinema.booking.dto.response.ShowtimeResponse;
import com.cinema.booking.dto.response.ShowtimeSeatsMapResponse;

import java.time.LocalDate;
import java.util.List;

public interface ShowtimeService {

    List<ShowtimeResponse> getShowtimes(Long movieId, Long cinemaId, LocalDate date);

    ShowtimeResponse getShowtimeById(Long id);

    ShowtimeSeatsMapResponse getShowtimeSeats(Long showtimeId);

    ShowtimeResponse createShowtime(ShowtimeCreateRequest request);
}