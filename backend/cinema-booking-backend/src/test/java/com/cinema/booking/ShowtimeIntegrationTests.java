package com.cinema.booking;

import com.cinema.booking.entity.*;
import com.cinema.booking.enums.MovieStatus;
import com.cinema.booking.enums.SeatType;
import com.cinema.booking.enums.ShowtimeSeatStatus;
import com.cinema.booking.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class ShowtimeIntegrationTests {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private MovieRepository movieRepository;

    @Autowired
    private CinemaRepository cinemaRepository;

    @Autowired
    private AuditoriumRepository auditoriumRepository;

    @Autowired
    private ShowtimeRepository showtimeRepository;

    @Autowired
    private ShowtimeSeatRepository showtimeSeatRepository;

    @Autowired
    private SeatRepository seatRepository;

    @Autowired(required = false)
    private StringRedisTemplate redisTemplate;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders
                .webAppContextSetup(context)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
    }

    @Test
    void testGetShowtimesAndSeatsMap() throws Exception {
        // 1. Tạo dữ liệu mẫu
        Movie movie = Movie.builder()
                .title("Godzilla x Kong")
                .description("The New Empire")
                .durationMinutes(115)
                .releaseDate(LocalDate.now())
                .genre("Action")
                .status(MovieStatus.NOW_SHOWING)
                .build();
        movieRepository.save(movie);

        Cinema cinema = Cinema.builder()
                .name("CGV Vincom Dong Khoi")
                .address("72 Le Thanh Ton")
                .city("Ho Chi Minh")
                .build();
        cinemaRepository.save(cinema);

        Auditorium auditorium = Auditorium.builder()
                .cinema(cinema)
                .name("Cinema 01 (IMAX)")
                .totalRows(10)
                .totalCols(12)
                .build();
        auditoriumRepository.save(auditorium);

        Seat seatA1 = Seat.builder()
                .auditorium(auditorium)
                .rowChar("A")
                .seatNumber(1)
                .type(SeatType.VIP)
                .isActive(true)
                .build();

        Seat seatA2 = Seat.builder()
                .auditorium(auditorium)
                .rowChar("A")
                .seatNumber(2)
                .type(SeatType.VIP)
                .isActive(true)
                .build();
        seatRepository.save(seatA1);
        seatRepository.save(seatA2);

        LocalDateTime now = LocalDateTime.now().plusHours(2);
        Showtime showtime = Showtime.builder()
                .movie(movie)
                .auditorium(auditorium)
                .startTime(now)
                .endTime(now.plusMinutes(115))
                .basePrice(new BigDecimal("120000.00"))
                .build();
        showtimeRepository.save(showtime);

        ShowtimeSeat ss1 = ShowtimeSeat.builder()
                .showtime(showtime)
                .seat(seatA1)
                .price(new BigDecimal("140000.00"))
                .status(ShowtimeSeatStatus.AVAILABLE)
                .build();

        ShowtimeSeat ss2 = ShowtimeSeat.builder()
                .showtime(showtime)
                .seat(seatA2)
                .price(new BigDecimal("140000.00"))
                .status(ShowtimeSeatStatus.AVAILABLE)
                .build();
        showtimeSeatRepository.save(ss1);
        showtimeSeatRepository.save(ss2);

        // 2. Test GET /api/v1/showtimes
        mockMvc.perform(get("/api/v1/showtimes")
                        .param("movieId", movie.getId().toString())
                        .param("cinemaId", cinema.getId().toString())
                        .param("date", LocalDate.now().toString())
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].movieTitle").value("Godzilla x Kong"))
                .andExpect(jsonPath("$.data[0].auditoriumName").value("Cinema 01 (IMAX)"));

        // 3. Test GET /api/v1/showtimes/{id}
        mockMvc.perform(get("/api/v1/showtimes/" + showtime.getId())
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(showtime.getId()));

        // 4. Test GET /api/v1/showtimes/{id}/seats (Khi chưa có key lock Redis)
        mockMvc.perform(get("/api/v1/showtimes/" + showtime.getId() + "/seats")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.seats[0].status").value("AVAILABLE"))
                .andExpect(jsonPath("$.data.seats[1].status").value("AVAILABLE"));

        // 5. Kiểm tra tính năng hợp nhất (merge) nếu Redis đang chạy và kết nối được
        if (redisTemplate != null) {
            String redisKey = "seat_lock:" + showtime.getId() + ":" + ss1.getId();
            try {
                redisTemplate.opsForValue().set(redisKey, "999");

                mockMvc.perform(get("/api/v1/showtimes/" + showtime.getId() + "/seats")
                                .contentType(MediaType.APPLICATION_JSON))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.data.seats[0].status").value("LOCKED"))
                        .andExpect(jsonPath("$.data.seats[1].status").value("AVAILABLE"));

                redisTemplate.delete(redisKey);
            } catch (Exception e) {
                // Redis offline trong môi trường test local -> Graceful fallback vẫn hoạt động bình thường
                System.out.println("Redis server offline, bỏ qua kiểm tra Redis active key: " + e.getMessage());
            }
        }
    }
}