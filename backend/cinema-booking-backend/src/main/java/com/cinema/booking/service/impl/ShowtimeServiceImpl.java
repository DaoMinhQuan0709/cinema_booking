package com.cinema.booking.service.impl;

import com.cinema.booking.dto.request.ShowtimeCreateRequest;
import com.cinema.booking.dto.response.ShowtimeResponse;
import com.cinema.booking.dto.response.ShowtimeSeatResponse;
import com.cinema.booking.dto.response.ShowtimeSeatsMapResponse;
import com.cinema.booking.entity.Auditorium;
import com.cinema.booking.entity.Movie;
import com.cinema.booking.entity.Showtime;
import com.cinema.booking.entity.ShowtimeSeat;
import com.cinema.booking.enums.ShowtimeSeatStatus;
import com.cinema.booking.exception.ResourceNotFoundException;
import com.cinema.booking.repository.AuditoriumRepository;
import com.cinema.booking.repository.MovieRepository;
import com.cinema.booking.repository.ShowtimeRepository;
import com.cinema.booking.repository.ShowtimeSeatRepository;
import com.cinema.booking.service.ShowtimeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShowtimeServiceImpl implements ShowtimeService {

    private final ShowtimeRepository showtimeRepository;
    private final ShowtimeSeatRepository showtimeSeatRepository;
    private final MovieRepository movieRepository;
    private final AuditoriumRepository auditoriumRepository;
    private final StringRedisTemplate redisTemplate;

    @Override
    @Transactional(readOnly = true)
    public List<ShowtimeResponse> getShowtimes(Long movieId, Long cinemaId, LocalDate date) {
        LocalDateTime startOfDay = null;
        LocalDateTime endOfDay = null;
        if (date != null) {
            startOfDay = date.atStartOfDay();
            endOfDay = date.atTime(LocalTime.MAX);
        }

        List<Showtime> showtimes = showtimeRepository.findShowtimes(movieId, cinemaId, startOfDay, endOfDay);
        return showtimes.stream().map(this::mapToShowtimeResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ShowtimeResponse getShowtimeById(Long id) {
        Showtime showtime = showtimeRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy suất chiếu với ID: " + id));
        return mapToShowtimeResponse(showtime);
    }

    @Override
    @Transactional(readOnly = true)
    public ShowtimeSeatsMapResponse getShowtimeSeats(Long showtimeId) {
        Showtime showtime = showtimeRepository.findByIdWithDetails(showtimeId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy suất chiếu với ID: " + showtimeId));

        List<ShowtimeSeat> showtimeSeats = showtimeSeatRepository.findByShowtimeIdWithSeat(showtimeId);

        // Quét các key Redis giữ chỗ 10 phút: pattern seat_lock:{showtimeId}:*
        Set<Long> lockedSeatIdsOnRedis = getLockedSeatIdsFromRedis(showtimeId);

        List<ShowtimeSeatResponse> seatResponses = showtimeSeats.stream().map(ss -> {
            ShowtimeSeatStatus effectiveStatus = ss.getStatus();

            // Nếu DB là AVAILABLE nhưng trên Redis đang có key giữ chỗ -> Trả về LOCKED
            if (effectiveStatus == ShowtimeSeatStatus.AVAILABLE && lockedSeatIdsOnRedis.contains(ss.getId())) {
                effectiveStatus = ShowtimeSeatStatus.LOCKED;
            }

            return ShowtimeSeatResponse.builder()
                    .showtimeSeatId(ss.getId())
                    .seatId(ss.getSeat().getId())
                    .rowChar(ss.getSeat().getRowChar())
                    .seatNumber(ss.getSeat().getSeatNumber())
                    .seatType(ss.getSeat().getType())
                    .price(ss.getPrice())
                    .status(effectiveStatus)
                    .build();
        }).collect(Collectors.toList());

        Auditorium auditorium = showtime.getAuditorium();

        return ShowtimeSeatsMapResponse.builder()
                .showtimeId(showtime.getId())
                .auditoriumId(auditorium.getId())
                .auditoriumName(auditorium.getName())
                .totalRows(auditorium.getTotalRows())
                .totalCols(auditorium.getTotalCols())
                .seats(seatResponses)
                .build();
    }

    @Override
    @Transactional
    public ShowtimeResponse createShowtime(ShowtimeCreateRequest request) {
        Movie movie = movieRepository.findById(request.getMovieId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phim với ID: " + request.getMovieId()));

        Auditorium auditorium = auditoriumRepository.findById(request.getAuditoriumId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng chiếu với ID: " + request.getAuditoriumId()));

        Showtime showtime = Showtime.builder()
                .movie(movie)
                .auditorium(auditorium)
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .basePrice(request.getBasePrice())
                .build();

        Showtime savedShowtime = showtimeRepository.save(showtime);
        log.info("Created new showtime with ID: {}", savedShowtime.getId());
        return mapToShowtimeResponse(savedShowtime);
    }

    private Set<Long> getLockedSeatIdsFromRedis(Long showtimeId) {
        try {
            String pattern = "seat_lock:" + showtimeId + ":*";
            Set<String> keys = redisTemplate.keys(pattern);
            if (keys == null || keys.isEmpty()) {
                return Collections.emptySet();
            }

            Set<Long> seatIds = new HashSet<>();
            for (String key : keys) {
                String[] parts = key.split(":");
                if (parts.length >= 3) {
                    try {
                        seatIds.add(Long.parseLong(parts[2]));
                    } catch (NumberFormatException ignored) {}
                }
            }
            return seatIds;
        } catch (Exception e) {
            log.warn("Lỗi khi quét Redis keys giữ chỗ cho showtimeId {}: {}", showtimeId, e.getMessage());
            return Collections.emptySet();
        }
    }

    private ShowtimeResponse mapToShowtimeResponse(Showtime showtime) {
        return ShowtimeResponse.builder()
                .id(showtime.getId())
                .movieId(showtime.getMovie().getId())
                .movieTitle(showtime.getMovie().getTitle())
                .posterUrl(showtime.getMovie().getPosterUrl())
                .cinemaId(showtime.getAuditorium().getCinema().getId())
                .cinemaName(showtime.getAuditorium().getCinema().getName())
                .auditoriumId(showtime.getAuditorium().getId())
                .auditoriumName(showtime.getAuditorium().getName())
                .startTime(showtime.getStartTime())
                .endTime(showtime.getEndTime())
                .basePrice(showtime.getBasePrice())
                .build();
    }
}