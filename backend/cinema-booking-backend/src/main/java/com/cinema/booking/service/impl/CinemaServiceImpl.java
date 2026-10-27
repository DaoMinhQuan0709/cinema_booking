package com.cinema.booking.service.impl;

import com.cinema.booking.dto.request.CinemaCreateRequest;
import com.cinema.booking.dto.response.AuditoriumSummaryResponse;
import com.cinema.booking.dto.response.CinemaResponse;
import com.cinema.booking.entity.Cinema;
import com.cinema.booking.exception.ResourceNotFoundException;
import com.cinema.booking.repository.CinemaRepository;
import com.cinema.booking.service.CinemaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CinemaServiceImpl implements CinemaService {

    private final CinemaRepository cinemaRepository;

    @Override
    @Transactional(readOnly = true)
    public List<CinemaResponse> getCinemas(String city) {
        List<Cinema> cinemas = cinemaRepository.findByCityIgnoreCaseWithAuditoriums(city);
        return cinemas.stream().map(this::mapToCinemaResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public CinemaResponse getCinemaById(Long id) {
        Cinema cinema = cinemaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy rạp với ID: " + id));
        return mapToCinemaResponse(cinema);
    }

    @Override
    @Transactional
    public CinemaResponse createCinema(CinemaCreateRequest request) {
        Cinema cinema = Cinema.builder()
                .name(request.getName().trim())
                .address(request.getAddress().trim())
                .city(request.getCity().trim())
                .build();

        Cinema savedCinema = cinemaRepository.save(cinema);
        log.info("Created new cinema with ID: {}", savedCinema.getId());
        return mapToCinemaResponse(savedCinema);
    }

    private CinemaResponse mapToCinemaResponse(Cinema cinema) {
        List<AuditoriumSummaryResponse> auditoriums = cinema.getAuditoriums() != null
                ? cinema.getAuditoriums().stream().map(a -> AuditoriumSummaryResponse.builder()
                        .id(a.getId())
                        .name(a.getName())
                        .totalRows(a.getTotalRows())
                        .totalCols(a.getTotalCols())
                        .build()).collect(Collectors.toList())
                : Collections.emptyList();

        return CinemaResponse.builder()
                .id(cinema.getId())
                .name(cinema.getName())
                .address(cinema.getAddress())
                .city(cinema.getCity())
                .auditoriums(auditoriums)
                .build();
    }
}