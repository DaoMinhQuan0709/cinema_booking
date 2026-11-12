package com.cinema.booking;

import com.cinema.booking.controller.AdminReportController;
import com.cinema.booking.dto.response.*;
import com.cinema.booking.dto.response.OccupancyReportResponse.CapacitySource;
import com.cinema.booking.exception.BadRequestException;
import com.cinema.booking.exception.GlobalExceptionHandler;
import com.cinema.booking.service.AdminReportService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Hợp đồng HTTP dùng MockMvc/service giả; không phải thử API đang chạy. */
class AdminReportControllerTests {
    private final AdminReportService service = mock(AdminReportService.class);
    private MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.standaloneSetup(new AdminReportController(service))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @Test void bindsRevenueFiltersAndSerializesGroupIdsAndActualTicketCounts() throws Exception {
        var day = LocalDate.of(2026, 11, 10);
        when(service.getRevenueReport(day, day, 2L, 3L, "movie")).thenReturn(RevenueReportResponse.builder()
                .totalRevenue(new BigDecimal("240000")).totalSuccessfulBookings(1L).totalTicketsSold(2L)
                .breakdown(List.of(RevenueReportResponse.RevenueItem.builder().id(3L).label("Phim").revenue(new BigDecimal("240000")).bookingCount(1L).ticketCount(2L).build())).build());
        mvc.perform(get("/api/v1/admin/reports/revenue").param("startDate", day.toString()).param("endDate", day.toString())
                        .param("cinemaId", "2").param("movieId", "3").param("groupBy", "movie"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.totalRevenue").value(240000)).andExpect(jsonPath("$.data.breakdown[0].id").value(3))
                .andExpect(jsonPath("$.data.breakdown[0].ticketCount").value(2));
        verify(service).getRevenueReport(day, day, 2L, 3L, "movie");
    }

    @Test void occupancyExposesMissingConfigurationAndHistoricalIdentity() throws Exception {
        var day = LocalDate.of(2020, 1, 1);
        when(service.getOccupancyReport(2L, 3L, day)).thenReturn(OccupancyReportResponse.builder()
                .totalSeatsAvailable(0L).totalSeatsBooked(0L).overallOccupancyRate(0.0).showtimesMissingCapacity(1L)
                .breakdown(List.of(OccupancyReportResponse.OccupancyItem.builder().showtimeId(9L).movieId(3L).cinemaId(2L).auditoriumId(4L)
                        .startTime(day.atTime(10, 0)).active(false).capacitySource(CapacitySource.UNCONFIGURED)
                        .totalSeats(0L).bookedSeats(0L).occupancyRate(0.0).label("Thiếu cấu hình").build())).build());
        mvc.perform(get("/api/v1/admin/reports/occupancy").param("date", day.toString()).param("cinemaId", "2").param("movieId", "3"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.showtimesMissingCapacity").value(1))
                .andExpect(jsonPath("$.data.breakdown[0].showtimeId").value(9))
                .andExpect(jsonPath("$.data.breakdown[0].active").value(false))
                .andExpect(jsonPath("$.data.breakdown[0].capacitySource").value("UNCONFIGURED"))
                .andExpect(jsonPath("$.data.overallOccupancyRate").value(0.0));
    }

    @Test void malformedFiltersReturn400BeforeServiceCalls() throws Exception {
        for (String suffix : List.of("revenue?startDate=2026-02-30", "occupancy?date=wrong", "revenue?movieId=bad", "occupancy?cinemaId=9223372036854775808")) {
            mvc.perform(get("/api/v1/admin/reports/" + suffix)).andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
    }

    @Test void serviceValidationBecomes400WithExistingApiResponseContract() throws Exception {
        when(service.getRevenueReport(null, null, null, null, "bad")).thenThrow(new BadRequestException("groupBy không hợp lệ."));
        mvc.perform(get("/api/v1/admin/reports/revenue").param("groupBy", "bad"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(400)).andExpect(jsonPath("$.message").value("groupBy không hợp lệ."));
    }
}
