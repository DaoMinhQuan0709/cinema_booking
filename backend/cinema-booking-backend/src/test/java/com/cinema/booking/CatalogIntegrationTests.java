package com.cinema.booking;

import com.cinema.booking.entity.Auditorium;
import com.cinema.booking.entity.Cinema;
import com.cinema.booking.entity.Movie;
import com.cinema.booking.entity.Product;
import com.cinema.booking.enums.MovieStatus;
import com.cinema.booking.repository.CinemaRepository;
import com.cinema.booking.repository.MovieRepository;
import com.cinema.booking.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class CatalogIntegrationTests {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private MovieRepository movieRepository;

    @Autowired
    private CinemaRepository cinemaRepository;

    @Autowired
    private ProductRepository productRepository;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders
                .webAppContextSetup(context)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
    }

    @Test
    void testGetMoviesWithPagingAndFilter() throws Exception {
        Movie movie1 = Movie.builder()
                .title("Dune: Part Two")
                .description("Paul Atreides unites with Chani...")
                .durationMinutes(166)
                .releaseDate(LocalDate.now())
                .genre("Sci-Fi")
                .status(MovieStatus.NOW_SHOWING)
                .build();

        Movie movie2 = Movie.builder()
                .title("Kung Fu Panda 4")
                .description("Po becomes Spiritual Leader...")
                .durationMinutes(94)
                .releaseDate(LocalDate.now().plusDays(10))
                .genre("Animation")
                .status(MovieStatus.COMING_SOON)
                .build();

        movieRepository.save(movie1);
        movieRepository.save(movie2);

        // Lấy danh sách phim NOW_SHOWING
        mockMvc.perform(get("/api/v1/movies")
                        .param("status", "NOW_SHOWING")
                        .param("keyword", "Dune")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.content[0].title").value("Dune: Part Two"));

        // Lấy chi tiết phim theo ID
        mockMvc.perform(get("/api/v1/movies/" + movie1.getId())
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.title").value("Dune: Part Two"))
                .andExpect(jsonPath("$.data.durationMinutes").value(166));

        // Lấy chi tiết phim không tồn tại -> 404
        mockMvc.perform(get("/api/v1/movies/999999")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));
    }

    @Test
    void testGetCinemasAndProducts() throws Exception {
        // Tạo Rạp
        Cinema cinema = Cinema.builder()
                .name("CGV Landmark 81")
                .address("772 Dien Bien Phu")
                .city("Ho Chi Minh")
                .build();
        cinemaRepository.save(cinema);

        // Tạo Bắp nước
        Product product = Product.builder()
                .name("Combo Bắp Nước 1")
                .description("1 Bắp ngọt + 1 Nước ngọt lớn")
                .price(new BigDecimal("89000.00"))
                .isAvailable(true)
                .build();
        productRepository.save(product);

        // Test GET /api/v1/cinemas
        mockMvc.perform(get("/api/v1/cinemas")
                        .param("city", "Ho Chi Minh")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].name").value("CGV Landmark 81"));

        // Test GET /api/v1/products
        mockMvc.perform(get("/api/v1/products")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].name").value("Combo Bắp Nước 1"));
    }
}