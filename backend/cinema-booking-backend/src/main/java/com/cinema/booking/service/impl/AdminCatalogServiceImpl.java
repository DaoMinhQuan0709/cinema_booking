package com.cinema.booking.service.impl;

import com.cinema.booking.dto.request.*;
import com.cinema.booking.dto.response.*;
import com.cinema.booking.entity.*;
import com.cinema.booking.enums.SeatType;
import com.cinema.booking.enums.ShowtimeSeatStatus;
import com.cinema.booking.exception.BadRequestException;
import com.cinema.booking.exception.ConflictException;
import com.cinema.booking.exception.ResourceNotFoundException;
import com.cinema.booking.repository.*;
import com.cinema.booking.service.AdminCatalogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminCatalogServiceImpl implements AdminCatalogService {

    private final MovieRepository movieRepository;
    private final CinemaRepository cinemaRepository;
    private final AuditoriumRepository auditoriumRepository;
    private final SeatRepository seatRepository;
    private final ShowtimeRepository showtimeRepository;
    private final ShowtimeSeatRepository showtimeSeatRepository;
    private final ProductRepository productRepository;

    // =========================================================================
    // PHIM (MOVIES)
    // =========================================================================

    @Override
    @Transactional
    public MovieResponse createMovie(MovieCreateRequest request) {
        log.info("Admin tao phim moi: title={}", request.getTitle());
        Movie movie = Movie.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .durationMinutes(request.getDurationMinutes())
                .releaseDate(request.getReleaseDate())
                .posterUrl(request.getPosterUrl())
                .trailerUrl(request.getTrailerUrl())
                .genre(request.getGenre())
                .ageRating(request.getAgeRating())
                .status(request.getStatus())
                .build();
        Movie saved = movieRepository.save(movie);
        return mapToMovieResponse(saved);
    }

    @Override
    @Transactional
    public MovieResponse updateMovie(Long id, MovieCreateRequest request) {
        log.info("Admin cap nhat phim id={}", id);
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay phim voi id: " + id));

        movie.setTitle(request.getTitle());
        movie.setDescription(request.getDescription());
        movie.setDurationMinutes(request.getDurationMinutes());
        movie.setReleaseDate(request.getReleaseDate());
        movie.setPosterUrl(request.getPosterUrl());
        movie.setTrailerUrl(request.getTrailerUrl());
        movie.setGenre(request.getGenre());
        movie.setAgeRating(request.getAgeRating());
        movie.setStatus(request.getStatus());

        return mapToMovieResponse(movieRepository.save(movie));
    }

    @Override
    @Transactional
    public void deleteMovie(Long id) {
        log.info("Admin xoa phim id={}", id);
        if (!movieRepository.existsById(id)) {
            throw new ResourceNotFoundException("Khong tim thay phim voi id: " + id);
        }
        movieRepository.deleteById(id);
    }

    // =========================================================================
    // RẠP & PHÒNG CHIẾU (CINEMAS & AUDITORIUMS)
    // =========================================================================

    @Override
    @Transactional
    public CinemaResponse createCinema(CinemaCreateRequest request) {
        log.info("Admin tao rap moi: name={}", request.getName());
        Cinema cinema = Cinema.builder()
                .name(request.getName())
                .address(request.getAddress())
                .city(request.getCity())
                .build();
        Cinema saved = cinemaRepository.save(cinema);
        return CinemaResponse.builder()
                .id(saved.getId())
                .name(saved.getName())
                .address(saved.getAddress())
                .city(saved.getCity())
                .auditoriums(new ArrayList<>())
                .build();
    }

    @Override
    @Transactional
    public AuditoriumSummaryResponse createAuditorium(Long cinemaId, AuditoriumCreateRequest request) {
        log.info("Admin tao phong chieu moi cho rap id={}: name={}", cinemaId, request.getName());
        Cinema cinema = cinemaRepository.findById(cinemaId)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay rap voi id: " + cinemaId));

        Auditorium auditorium = Auditorium.builder()
                .cinema(cinema)
                .name(request.getName())
                .totalRows(request.getTotalRows())
                .totalCols(request.getTotalCols())
                .build();
        Auditorium saved = auditoriumRepository.save(auditorium);

        return AuditoriumSummaryResponse.builder()
                .id(saved.getId())
                .name(saved.getName())
                .totalRows(saved.getTotalRows())
                .totalCols(saved.getTotalCols())
                .build();
    }

    @Override
    @Transactional
    public void createSeatsBatch(Long auditoriumId, SeatBatchCreateRequest request) {
        log.info("Admin tao ghe batch cho phong chieu id={}", auditoriumId);
        Auditorium auditorium = auditoriumRepository.findById(auditoriumId)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay phong chieu voi id: " + auditoriumId));

        // Xoa cac ghe cu neu co
        seatRepository.deleteByAuditoriumId(auditoriumId);

        List<Seat> seats = new ArrayList<>();
        int totalRows = auditorium.getTotalRows();
        int totalCols = auditorium.getTotalCols();

        List<String> vipRows = request.getVipRows() != null ? request.getVipRows() : List.of();
        List<String> coupleRows = request.getCoupleRows() != null ? request.getCoupleRows() : List.of();
        SeatType defaultType = request.getDefaultType() != null ? request.getDefaultType() : SeatType.STANDARD;

        for (int r = 0; r < totalRows; r++) {
            String rowChar = String.valueOf((char) ('A' + r));
            SeatType rowType = defaultType;

            if (vipRows.contains(rowChar)) {
                rowType = SeatType.VIP;
            } else if (coupleRows.contains(rowChar)) {
                rowType = SeatType.COUPLE;
            }

            for (int c = 1; c <= totalCols; c++) {
                Seat seat = Seat.builder()
                        .auditorium(auditorium)
                        .rowChar(rowChar)
                        .seatNumber(c)
                        .type(rowType)
                        .isActive(true)
                        .build();
                seats.add(seat);
            }
        }

        seatRepository.saveAll(seats);
        log.info("Da tao thanh cong {} ghe cho phong chieu id={}", seats.size(), auditoriumId);
    }

    // =========================================================================
    // LỊCH CHIẾU (SHOWTIMES)
    // =========================================================================

    @Override
    @Transactional
    public ShowtimeResponse createShowtime(ShowtimeCreateRequest request) {
        log.info("Admin tao lich chieu moi: movieId={}, auditoriumId={}, startTime={}",
                request.getMovieId(), request.getAuditoriumId(), request.getStartTime());

        Movie movie = movieRepository.findById(request.getMovieId())
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay phim voi id: " + request.getMovieId()));

        Auditorium auditorium = auditoriumRepository.findById(request.getAuditoriumId())
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay phong chieu voi id: " + request.getAuditoriumId()));

        if (request.getStartTime().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Thoi gian bat dau phai o tuong lai");
        }

        // Tinh end_time neu chua co (startTime + durationMinutes + 15 phut don dep phong)
        LocalDateTime endTime = request.getEndTime();
        if (endTime == null) {
            endTime = request.getStartTime().plusMinutes(movie.getDurationMinutes() + 15);
        } else if (endTime.isBefore(request.getStartTime())) {
            throw new BadRequestException("Thoi gian ket thuc phai sau thoi gian bat dau");
        }

        // Kiem tra xung dot gio chieu cung phong chieu
        boolean isOverlapping = showtimeRepository.existsOverlappingShowtime(
                auditorium.getId(), request.getStartTime(), endTime, null);
        if (isOverlapping) {
            throw new ConflictException("Xung dot lich chieu! Phong chieu " + auditorium.getName() + " da co suat chieu khac trong khoang thoi gian nay");
        }

        Showtime showtime = Showtime.builder()
                .movie(movie)
                .auditorium(auditorium)
                .startTime(request.getStartTime())
                .endTime(endTime)
                .basePrice(request.getBasePrice())
                .build();
        Showtime savedShowtime = showtimeRepository.save(showtime);

        // Tự động sinh danh sách showtime_seats dựa trên cấu hình vật lý của phòng chiếu
        List<Seat> physicalSeats = seatRepository.findByAuditoriumIdOrderByRowCharAscSeatNumberAsc(auditorium.getId());
        if (physicalSeats.isEmpty()) {
            log.warn("Phong chieu id={} chua co ghe vat ly nao duoc cau hinh!", auditorium.getId());
        } else {
            List<ShowtimeSeat> showtimeSeats = new ArrayList<>();
            for (Seat seat : physicalSeats) {
                if (!seat.getIsActive()) continue;

                BigDecimal seatPrice = request.getBasePrice();
                if (seat.getType() == SeatType.VIP) {
                    seatPrice = seatPrice.add(BigDecimal.valueOf(20000)); // Phu thu VIP 20k
                } else if (seat.getType() == SeatType.COUPLE) {
                    seatPrice = seatPrice.add(BigDecimal.valueOf(40000)); // Phu thu Couple 40k
                }

                ShowtimeSeat showtimeSeat = ShowtimeSeat.builder()
                        .showtime(savedShowtime)
                        .seat(seat)
                        .price(seatPrice)
                        .status(ShowtimeSeatStatus.AVAILABLE)
                        .version(0)
                        .build();
                showtimeSeats.add(showtimeSeat);
            }
            showtimeSeatRepository.saveAll(showtimeSeats);
            log.info("Da tu dong sinh {} showtime_seats cho suat chieu id={}", showtimeSeats.size(), savedShowtime.getId());
        }

        return mapToShowtimeResponse(savedShowtime);
    }

    @Override
    @Transactional
    public void deleteShowtime(Long id) {
        log.info("Admin xoa suat chieu id={}", id);
        if (!showtimeRepository.existsById(id)) {
            throw new ResourceNotFoundException("Khong tim thay suat chieu voi id: " + id);
        }
        showtimeRepository.deleteById(id);
    }

    // =========================================================================
    // BẮP NƯỚC (PRODUCTS)
    // =========================================================================

    @Override
    @Transactional
    public ProductResponse createProduct(ProductCreateRequest request) {
        log.info("Admin tao san pham bap nuoc moi: name={}", request.getName());
        Product product = Product.builder()
                .name(request.getName())
                .description(request.getDescription())
                .price(request.getPrice())
                .imageUrl(request.getImageUrl())
                .isAvailable(request.getIsAvailable() != null ? request.getIsAvailable() : true)
                .build();
        Product saved = productRepository.save(product);
        return mapToProductResponse(saved);
    }

    @Override
    @Transactional
    public ProductResponse updateProduct(Long id, ProductCreateRequest request) {
        log.info("Admin cap nhat san pham bap nuoc id={}", id);
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay san pham voi id: " + id));

        product.setName(request.getName());
        product.setDescription(request.getDescription());
        product.setPrice(request.getPrice());
        product.setImageUrl(request.getImageUrl());
        if (request.getIsAvailable() != null) {
            product.setIsAvailable(request.getIsAvailable());
        }

        return mapToProductResponse(productRepository.save(product));
    }

    @Override
    @Transactional
    public void deleteProduct(Long id) {
        log.info("Admin xoa san pham bap nuoc id={}", id);
        if (!productRepository.existsById(id)) {
            throw new ResourceNotFoundException("Khong tim thay san pham voi id: " + id);
        }
        productRepository.deleteById(id);
    }

    // =========================================================================
    // HELPER MAPPERS
    // =========================================================================

    private MovieResponse mapToMovieResponse(Movie movie) {
        return MovieResponse.builder()
                .id(movie.getId())
                .title(movie.getTitle())
                .description(movie.getDescription())
                .durationMinutes(movie.getDurationMinutes())
                .releaseDate(movie.getReleaseDate())
                .posterUrl(movie.getPosterUrl())
                .trailerUrl(movie.getTrailerUrl())
                .genre(movie.getGenre())
                .ageRating(movie.getAgeRating())
                .status(movie.getStatus())
                .createdAt(movie.getCreatedAt())
                .build();
    }

    private ShowtimeResponse mapToShowtimeResponse(Showtime showtime) {
        return ShowtimeResponse.builder()
                .id(showtime.getId())
                .movieId(showtime.getMovie().getId())
                .movieTitle(showtime.getMovie().getTitle())
                .posterUrl(showtime.getMovie().getPosterUrl())
                .auditoriumId(showtime.getAuditorium().getId())
                .auditoriumName(showtime.getAuditorium().getName())
                .cinemaId(showtime.getAuditorium().getCinema().getId())
                .cinemaName(showtime.getAuditorium().getCinema().getName())
                .startTime(showtime.getStartTime())
                .endTime(showtime.getEndTime())
                .basePrice(showtime.getBasePrice())
                .build();
    }

    private ProductResponse mapToProductResponse(Product product) {
        return ProductResponse.builder()
                .id(product.getId())
                .name(product.getName())
                .description(product.getDescription())
                .price(product.getPrice())
                .imageUrl(product.getImageUrl())
                .isAvailable(product.getIsAvailable())
                .build();
    }
}

