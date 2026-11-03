package com.cinema.booking.service;

import com.cinema.booking.dto.request.*;
import com.cinema.booking.dto.response.*;

import java.util.List;

public interface AdminCatalogService {

    // --- PHIM (MOVIES) ---
    MovieResponse createMovie(MovieCreateRequest request);
    MovieResponse updateMovie(Long id, MovieCreateRequest request);
    void deleteMovie(Long id);

    // --- RẠP & PHÒNG CHIẾU (CINEMAS & AUDITORIUMS) ---
    CinemaResponse createCinema(CinemaCreateRequest request);
    AuditoriumSummaryResponse createAuditorium(Long cinemaId, AuditoriumCreateRequest request);
    void createSeatsBatch(Long auditoriumId, SeatBatchCreateRequest request);

    // --- LỊCH CHIẾU (SHOWTIMES) ---
    ShowtimeResponse createShowtime(ShowtimeCreateRequest request);
    void deleteShowtime(Long id);

    // --- BẮP NƯỚC (PRODUCTS) ---
    ProductResponse createProduct(ProductCreateRequest request);
    ProductResponse updateProduct(Long id, ProductCreateRequest request);
    void deleteProduct(Long id);
}

