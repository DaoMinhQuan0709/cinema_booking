package com.cinema.booking;

import com.cinema.booking.config.*;
import com.cinema.booking.service.*;
import com.cinema.booking.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.mock.env.MockEnvironment;
import java.math.BigDecimal;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PaymentGatewayTests {
    @Test void rejectsUntrustedRedirectsAndNonIntegralVndAmounts() {
        for (String url : new String[]{"http://sandbox.vnpayment.vn/pay", "https://sandbox.vnpayment.vn.evil.invalid/pay", "https://user@sandbox.vnpayment.vn/pay", "https://test-payment.momo.vn/pay"})
            assertThrows(BadRequestException.class, () -> PaymentGateway.safeUrl(url, "VNPAY"));
        assertThrows(BadRequestException.class, () -> CheckoutSupport.money(new BigDecimal("10000.50")));
        assertThrows(BadRequestException.class, () -> CheckoutSupport.money(new BigDecimal("10000000000")));
    }

    @Test void signsTheReservedReferenceAndAmountAndUsesVietnamTime() throws Exception {
        var config = mock(VNPayConfig.class); when(config.getUrl()).thenReturn("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
        when(config.getHashSecret()).thenReturn("test-only-signing-key"); when(config.getTmnCode()).thenReturn("test-merchant");
        when(config.getReturnUrl()).thenReturn("http://localhost:5173/payment/vnpay-callback");
        var gateway = new PaymentGateway(config, mock(MoMoConfig.class), Clock.fixed(Instant.parse("2026-11-09T06:00:00Z"), BookingClockConfig.ZONE));
        String url = gateway.create(new PaymentGateway.Order("BKTEST", "VNPAY", new BigDecimal("80000"), "attempt-reference", "request", LocalDateTime.of(2026,11,9,13,10), "127.0.0.1"));
        assertTrue(url.contains("vnp_TxnRef=attempt-reference")); assertTrue(url.contains("vnp_Amount=8000000"));
        assertTrue(url.contains("vnp_CreateDate=20261109130000")); assertTrue(url.contains("vnp_ExpireDate=20261109131000"));
        String query = java.net.URI.create(url).getRawQuery(); int index = query.indexOf("&vnp_SecureHash=");
        // VNPAY 2.1.0 signs sorted, form-encoded values (spaces become '+').
        assertEquals("vnp_Amount=8000000&vnp_Command=pay&vnp_CreateDate=20261109130000&vnp_CurrCode=VND"
                + "&vnp_ExpireDate=20261109131000&vnp_IpAddr=127.0.0.1&vnp_Locale=vn&vnp_OrderInfo=Thanh+toan+ve+BKTEST"
                + "&vnp_OrderType=other&vnp_ReturnUrl=http%3A%2F%2Flocalhost%3A5173%2Fpayment%2Fvnpay-callback"
                + "&vnp_TmnCode=test-merchant&vnp_TxnRef=attempt-reference&vnp_Version=2.1.0", query.substring(0,index));
        // Independently calculated with Node crypto; do not use the signing implementation as the oracle.
        assertEquals("ea33aa88d8e0793bd8ef02264259e956c13f81614d3b4e489f2b6e977f0a47e8e89a0177cd491062c54a74dbce3a73d701f79b491b400ec2852b7d120bd8a683",
                query.substring(index + "&vnp_SecureHash=".length()));
    }

    @Test void rejectsMissingPlaceholderOrPaddedMerchantCredentials() {
        var config = mock(VNPayConfig.class);
        when(config.getUrl()).thenReturn("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
        var gateway = new PaymentGateway(config, mock(MoMoConfig.class), Clock.systemUTC());
        for (String invalid : new String[]{null, "", "  ", "your-value", "<value-from-vnpay>", " test-value", "test-value\n"}) {
            when(config.getTmnCode()).thenReturn("test-merchant");
            when(config.getHashSecret()).thenReturn(invalid);
            assertThrows(BadRequestException.class, () -> gateway.validate("VNPAY"));
            when(config.getHashSecret()).thenReturn("test-only-signing-key");
            when(config.getTmnCode()).thenReturn(invalid);
            assertThrows(BadRequestException.class, () -> gateway.validate("VNPAY"));
        }
        when(config.getTmnCode()).thenReturn("test-merchant");
        assertDoesNotThrow(() -> gateway.validate("VNPAY"));
    }

    @Test void neverFallsBackToBundledDemoCredentials() {
        var config = resolveConfig(new MockEnvironment());
        assertEquals("", config.getTmnCode());
        assertEquals("", config.getHashSecret());
        var gateway = new PaymentGateway(config, mock(MoMoConfig.class), Clock.systemUTC());
        var error = assertThrows(BadRequestException.class, () -> gateway.validate("VNPAY"));
        assertTrue(error.getMessage().contains("VNPAY_TMN_CODE"));
        assertTrue(error.getMessage().contains("VNPAY_HASH_SECRET"));
    }

    @Test void readsEnvironmentCredentialsAndAllowsExplicitLocalConfiguration() {
        var environment = new MockEnvironment().withProperty("VNPAY_TMN_CODE", "test-env-merchant")
                .withProperty("VNPAY_HASH_SECRET", "test-env-secret");
        var config = resolveConfig(environment);
        assertEquals("test-env-merchant", config.getTmnCode());
        assertEquals("test-env-secret", config.getHashSecret());
        environment.withProperty("application.payment.vnpay.tmn-code", "test-local-merchant")
                .withProperty("application.payment.vnpay.hash-secret", "test-local-secret");
        config = resolveConfig(environment);
        assertEquals("test-local-merchant", config.getTmnCode());
        assertEquals("test-local-secret", config.getHashSecret());
    }

    private static VNPayConfig resolveConfig(MockEnvironment environment) {
        try (var context = new AnnotationConfigApplicationContext()) {
            context.setEnvironment(environment);
            context.register(VNPayConfig.class);
            context.refresh();
            return context.getBean(VNPayConfig.class);
        }
    }
}
