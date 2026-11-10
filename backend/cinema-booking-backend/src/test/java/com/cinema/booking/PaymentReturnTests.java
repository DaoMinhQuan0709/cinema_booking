package com.cinema.booking;

import com.cinema.booking.config.VNPayConfig;
import com.cinema.booking.controller.PaymentController;
import com.cinema.booking.dto.response.BookingResponse;
import com.cinema.booking.dto.response.CheckoutResponse;
import com.cinema.booking.entity.Payment;
import com.cinema.booking.entity.PaymentAttempt;
import com.cinema.booking.enums.*;
import com.cinema.booking.exception.*;
import com.cinema.booking.repository.*;
import com.cinema.booking.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.User;
import org.springframework.http.MediaType;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PaymentReturnTests {
    private static final String REFERENCE = "a".repeat(32), CODE = "BKTEST", EMAIL = "owner@example.invalid";
    private static final String KEY = "test-only-return-signing-key";
    private final VNPayConfig config = new VNPayConfig();
    private final PaymentAttemptRepository attempts = mock(PaymentAttemptRepository.class);
    private final PaymentRepository payments = mock(PaymentRepository.class);
    private final BookingService bookings = mock(BookingService.class);
    private final PaymentReturnService service = new PaymentReturnService(config, attempts, payments, bookings);
    private BookingResponse booking;
    private PaymentAttempt attempt;

    @BeforeEach void setup() {
        ReflectionTestUtils.setField(config, "tmnCode", "TEST0001");
        ReflectionTestUtils.setField(config, "hashSecret", KEY);
        booking = BookingResponse.builder().id(1L).bookingCode(CODE).status(BookingStatus.PENDING)
                .checkout(CheckoutResponse.builder().state(CheckoutState.READY).paymentUrl("https://sandbox.vnpayment.vn/sensitive").build()).build();
        attempt = PaymentAttempt.builder().providerOrderId(REFERENCE).method("VNPAY").amount(new BigDecimal("80000"))
                .outcome(PaymentStatus.PENDING).state(CheckoutState.READY).build();
        when(attempts.findVNPayBookingCode(REFERENCE)).thenReturn(Optional.of(CODE));
        when(attempts.findByProviderOrderId(REFERENCE)).thenReturn(Optional.of(attempt));
        when(bookings.getBookingByCode(CODE, EMAIL)).thenReturn(booking);
        when(payments.findByBookingId(1L)).thenReturn(Optional.of(Payment.builder().status(PaymentStatus.PENDING).build()));
    }

    private Map<String, String> signed(Map<String, String> overrides) {
        var values = new TreeMap<>(Map.of("vnp_TxnRef", REFERENCE, "vnp_TmnCode", "TEST0001", "vnp_Amount", "8000000",
                "vnp_ResponseCode", "00", "vnp_TransactionStatus", "00", "vnp_TransactionNo", "12345"));
        values.putAll(overrides);
        String query = values.entrySet().stream().map(e -> e.getKey() + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.US_ASCII)).collect(Collectors.joining("&"));
        values.put("vnp_SecureHash", VNPayConfig.hmacSHA512(KEY, query));
        return values;
    }

    @Test void verifiesReturnWithoutSettlingOrLeakingResumableUrl() {
        var result = service.verifyVNPay(signed(Map.of()), EMAIL);
        assertEquals("00", result.gatewayResponseCode());
        assertEquals(PaymentStatus.PENDING, result.paymentStatus());
        assertEquals(BookingStatus.PENDING, result.booking().getStatus());
        assertEquals(PaymentStatus.PENDING, attempt.getOutcome());
        assertNull(result.booking().getCheckout().getPaymentUrl());
        verify(attempts, never()).save(any()); verify(payments, never()).save(any());
    }

    @Test void rejectsTamperedSignedResultBeforeLookingUpAnOrder() {
        var params = signed(Map.of("vnp_ResponseCode", "24")); params.put("vnp_ResponseCode", "00");
        assertThrows(BadRequestException.class, () -> service.verifyVNPay(params, EMAIL));
        verifyNoInteractions(attempts, bookings, payments);
    }

    @Test void rejectsWrongMerchantEvenIfSignedWithTheSameTestKey() {
        assertThrows(BadRequestException.class, () -> service.verifyVNPay(signed(Map.of("vnp_TmnCode", "OTHER001")), EMAIL));
        verifyNoInteractions(attempts, bookings, payments);
    }

    @Test void checksFrozenAttemptAmountAndRecognizedReference() {
        assertThrows(BadRequestException.class, () -> service.verifyVNPay(signed(Map.of("vnp_Amount", "1")), EMAIL));
        assertThrows(ResourceNotFoundException.class, () -> service.verifyVNPay(signed(Map.of("vnp_TxnRef", "unknown")), EMAIL));
    }

    @Test void deniesAnotherAccountBeforeReturningReceiptOrPaymentState() {
        when(bookings.getBookingByCode(CODE, "other@example.invalid")).thenThrow(new ForbiddenException("Denied"));
        assertThrows(ForbiddenException.class, () -> service.verifyVNPay(signed(Map.of()), "other@example.invalid"));
        verifyNoInteractions(payments);
    }

    @Test void returnsPersistedConfirmationIndependentlyOfTheRedirectStatus() {
        booking.setStatus(BookingStatus.CONFIRMED); attempt.setOutcome(PaymentStatus.SUCCESS);
        when(payments.findByBookingId(1L)).thenReturn(Optional.of(Payment.builder().status(PaymentStatus.SUCCESS).build()));
        var result = service.verifyVNPay(signed(Map.of("vnp_ResponseCode", "24", "vnp_TransactionStatus", "02")), EMAIL);
        assertEquals(PaymentStatus.SUCCESS, result.paymentStatus());
        assertEquals("24", result.gatewayResponseCode());
    }

    @Test void rejectsMalformedParameters() {
        assertThrows(BadRequestException.class, () -> service.verifyVNPay(Map.of(), EMAIL));
        assertThrows(BadRequestException.class, () -> service.verifyVNPay(signed(Map.of("vnp_Amount", "-1")), EMAIL));
        verifyNoInteractions(attempts, bookings, payments);
    }

    @Test void endpointReturnsVerifiedPrivateResultAndDisablesHttpCaching() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new PaymentController(mock(PaymentService.class), service))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
        var user = User.withUsername(EMAIL).password("unused").roles("USER").build();
        SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(user, null, user.getAuthorities()));
        try {
            mvc.perform(post("/api/v1/payments/vnpay-return").contentType(MediaType.APPLICATION_JSON)
                    .content(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(signed(Map.of()))))
                    .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                    .andExpect(jsonPath("$.data.booking.bookingCode").value(CODE))
                    .andExpect(jsonPath("$.data.paymentStatus").value("PENDING"));
        } finally { SecurityContextHolder.clearContext(); }
    }
}
