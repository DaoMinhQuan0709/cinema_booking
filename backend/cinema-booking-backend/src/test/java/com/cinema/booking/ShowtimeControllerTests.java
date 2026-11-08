package com.cinema.booking;

import com.cinema.booking.controller.ShowtimeController;
import com.cinema.booking.dto.response.ShowtimeResponse;
import com.cinema.booking.dto.response.ShowtimeSeatsMapResponse;
import com.cinema.booking.exception.GlobalExceptionHandler;
import com.cinema.booking.exception.ResourceNotFoundException;
import com.cinema.booking.service.ShowtimeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** HTTP binding regression tests; no Spring application, DB, Redis or seat writes. */
class ShowtimeControllerTests {
    private MockMvc mvc;
    private ShowtimeService service;

    @BeforeEach
    void setUp() {
        service = mock(ShowtimeService.class);
        mvc = MockMvcBuilders.standaloneSetup(new ShowtimeController(service))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @Test
    void galaxySessionCodeReturns400ForBothEndpointsWithoutCallingInventory() throws Exception {
        for (String suffix : List.of("", "/seats")) {
            mvc.perform(get("/api/v1/showtimes/1011-226432" + suffix))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(400));
        }
        verifyNoInteractions(service);
    }

    @Test
    void oversizedIdsAndInvalidFiltersAreBadRequestsInsteadOf500() throws Exception {
        for (String path : List.of("/api/v1/showtimes/9223372036854775808/seats",
                "/api/v1/showtimes?movieId=abc", "/api/v1/showtimes?date=not-a-date")) {
            mvc.perform(get(path)).andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
    }

    @Test
    void internalIdsReturnTheDetailAndSeatMapThroughTheSameContract() throws Exception {
        when(service.getShowtimeById(2871L)).thenReturn(ShowtimeResponse.builder().id(2871L).movieTitle("Movie").build());
        when(service.getShowtimeSeats(2871L)).thenReturn(ShowtimeSeatsMapResponse.builder().showtimeId(2871L).seats(List.of()).build());
        mvc.perform(get("/api/v1/showtimes/2871")).andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(2871));
        mvc.perform(get("/api/v1/showtimes/2871/seats")).andExpect(status().isOk()).andExpect(jsonPath("$.data.showtimeId").value(2871));
    }

    @Test
    void aMissingInternalIdStillReturns404() throws Exception {
        when(service.getShowtimeSeats(999L)).thenThrow(new ResourceNotFoundException("Không tìm thấy suất chiếu"));
        mvc.perform(get("/api/v1/showtimes/999/seats")).andExpect(status().isNotFound());
    }
}
