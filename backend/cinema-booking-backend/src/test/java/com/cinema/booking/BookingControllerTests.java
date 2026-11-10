package com.cinema.booking;

import com.cinema.booking.controller.BookingController;
import com.cinema.booking.dto.response.BookingResponse;
import com.cinema.booking.exception.GlobalExceptionHandler;
import com.cinema.booking.exception.SeatConflictException;
import com.cinema.booking.service.BookingService;
import com.cinema.booking.service.QrCodeService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class BookingControllerTests {
    private BookingService bookings;
    private com.cinema.booking.service.BookingProductsService products;
    private MockMvc mvc;
    private static final String REQUEST = """
            {"showtimeId":5716,"showtimeSeatIds":[101],"products":[]}
            """;

    @BeforeEach
    void setUp() {
        bookings = mock(BookingService.class);
        products = mock(com.cinema.booking.service.BookingProductsService.class);
        mvc = MockMvcBuilders.standaloneSetup(new BookingController(bookings, mock(QrCodeService.class), products))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .build();
        var user = User.withUsername("test@example.invalid").password("unused").roles("USER").build();
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(user, null, user.getAuthorities()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void redisOutageReturnsServiceUnavailableRatherThanAnInternalErrorOrSeatConflict() throws Exception {
        when(bookings.createBooking(any(), eq("test@example.invalid")))
                .thenThrow(new RedisConnectionFailureException("Connection refused"));
        mvc.perform(post("/api/v1/bookings").contentType(MediaType.APPLICATION_JSON).content(REQUEST))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value(503))
                .andExpect(jsonPath("$.message").value("Dịch vụ giữ ghế tạm thời không khả dụng. Vui lòng thử lại sau."));
        verify(bookings, times(1)).createBooking(argThat(request -> request.getShowtimeId() == 5716L
                && request.getShowtimeSeatIds().equals(java.util.List.of(101L))), eq("test@example.invalid"));
    }

    @Test
    void anAlreadyHeldSeatStillReturnsConflict() throws Exception {
        when(bookings.createBooking(any(), anyString())).thenThrow(new SeatConflictException("Ghế đã được giữ"));
        mvc.perform(post("/api/v1/bookings").contentType(MediaType.APPLICATION_JSON).content(REQUEST))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value(409));
    }

    @Test
    void successfulHoldStillReturnsCreatedAndItsBookingCode() throws Exception {
        when(bookings.createBooking(any(), anyString())).thenReturn(BookingResponse.builder().bookingCode("BKTEST123").build());
        mvc.perform(post("/api/v1/bookings").contentType(MediaType.APPLICATION_JSON).content(REQUEST))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.bookingCode").value("BKTEST123"));
    }

    @Test void productsEndpointReturnsAnUnambiguousServerTimeAndDeadline() throws Exception {
        var now = java.time.Instant.parse("2026-11-09T06:00:00Z");
        when(products.replace(eq("BKTEST123"), any(), eq("test@example.invalid"))).thenReturn(BookingResponse.builder()
                .bookingCode("BKTEST123").serverTime(now).checkoutRevision("a".repeat(64))
                .checkout(com.cinema.booking.dto.response.CheckoutResponse.builder().state(com.cinema.booking.enums.CheckoutState.EDITABLE)
                        .expiresAt(now.plusSeconds(600)).canEditProducts(true).build()).build());
        mvc.perform(put("/api/v1/bookings/BKTEST123/products").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedRevision\":\"" + "a".repeat(64) + "\",\"products\":[]}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.serverTime").value("2026-11-09T06:00:00Z"))
                .andExpect(jsonPath("$.data.checkout.expiresAt").value("2026-11-09T06:10:00Z"));
    }

    @Test void productsEndpointRequiresRevisionAndRejectsNullItems() throws Exception {
        mvc.perform(put("/api/v1/bookings/BKTEST123/products").contentType(MediaType.APPLICATION_JSON).content("{\"products\":[]}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/v1/bookings/BKTEST123/products").contentType(MediaType.APPLICATION_JSON).content("{\"expectedRevision\":\"a\",\"products\":[null]}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(products);
    }

    @Test void productsEndpointRejectsNegativeQuantityBeforeCallingService() throws Exception {
        mvc.perform(put("/api/v1/bookings/BKTEST123/products").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedRevision\":\"a\",\"products\":[{\"productId\":1,\"quantity\":-1}]}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(products);
    }
}
