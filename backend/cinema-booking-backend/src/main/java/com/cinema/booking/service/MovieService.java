package com.cinema.booking.service;

import com.cinema.booking.dto.request.MovieCreateRequest;
import com.cinema.booking.dto.response.MovieResponse;
import com.cinema.booking.dto.response.PageResponse;
import com.cinema.booking.enums.MovieStatus;
import org.springframework.data.domain.Pageable;

public interface MovieService {

    PageResponse<MovieResponse> getMovies(MovieStatus status, String genre, String keyword, Pageable pageable);

    MovieResponse getMovieById(Long id);

    MovieResponse createMovie(MovieCreateRequest request);
}