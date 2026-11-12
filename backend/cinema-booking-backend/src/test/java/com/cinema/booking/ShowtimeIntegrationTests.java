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
import java.time.Duration;
import com.cinema.booking.config.BookingClockConfig;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertEquals;

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

        LocalDate testDay = LocalDate.now(BookingClockConfig.ZONE).plusDays(1);
        LocalDateTime now = testDay.atTime(14, 0);
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
        // @Version đã có giá trị khiến save dùng merge; ID nằm trên entity được trả về.
        ss1 = showtimeSeatRepository.save(ss1);
        ss2 = showtimeSeatRepository.save(ss2);
        assertNotNull(ss1.getId());
        assertNotNull(ss2.getId());

        // 2. Test GET /api/v1/showtimes
        mockMvc.perform(get("/api/v1/showtimes")
                        .param("movieId", movie.getId().toString())
                        .param("cinemaId", cinema.getId().toString())
                        .param("date", testDay.toString())
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

        // 5. Helper nghiệm thu yêu cầu Redis thật; lỗi kết nối phải làm test thất bại.
        if ("true".equals(System.getenv("CINEMA_TEST_REDIS"))) {
            assertNotNull(redisTemplate);
            String redisKey = "seat_lock:" + showtime.getId() + ":" + ss1.getId();
            try {
                redisTemplate.opsForValue().set(redisKey, "integration-hold", Duration.ofSeconds(30));
                assertEquals("integration-hold", redisTemplate.opsForValue().get(redisKey));

                mockMvc.perform(get("/api/v1/showtimes/" + showtime.getId() + "/seats")
                                .contentType(MediaType.APPLICATION_JSON))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.data.seats[0].status").value("LOCKED"))
                        .andExpect(jsonPath("$.data.seats[1].status").value("AVAILABLE"));

            } finally { redisTemplate.delete(redisKey); }
        }
    }
}
