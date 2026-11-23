package com.cinema.booking.service;

import com.cinema.booking.config.VNPayConfig;
import com.cinema.booking.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Component @RequiredArgsConstructor
public class PaymentGateway {
    private final VNPayConfig vnpay;
    private final Clock clock;

    public record Order(String code, String method, BigDecimal amount, String orderId, String requestId, LocalDateTime expiresAt, String ip) { }

    public void validate(String method) {
        requireSupportedMethod(method);
        if (missingCredential(vnpay.getTmnCode()) || missingCredential(vnpay.getHashSecret()))
            throw new BadRequestException("VNPay Sandbox chưa được cấu hình. Cần cặp VNPAY_TMN_CODE và VNPAY_HASH_SECRET do VNPay cấp cho cùng một website.");
        if (!vnpay.getTmnCode().equals(vnpay.getTmnCode().strip()) || !vnpay.getHashSecret().equals(vnpay.getHashSecret().strip()))
            throw new BadRequestException("Cấu hình VNPay chứa khoảng trắng thừa ở đầu/cuối. Vui lòng kiểm tra lại mã website và khóa bí mật.");
        safeUrl(vnpay.getUrl(), method);
    }

    private static void requireSupportedMethod(String method) {
        if (!"VNPAY".equals(method)) throw new BadRequestException("Phương thức thanh toán chỉ hỗ trợ VNPay.");
    }

    private static boolean missingCredential(String value) {
        return value == null || value.isBlank() || value.toLowerCase(Locale.ROOT).contains("your-") || value.strip().startsWith("<");
    }

    public String create(Order order) throws Exception {
        requireSupportedMethod(order.method());
        return createVNPay(order);
    }

    public static String safeUrl(String url, String method) {
        requireSupportedMethod(method);
        try {
            URI uri = URI.create(url);
            if (!"https".equals(uri.getScheme()) || !"sandbox.vnpayment.vn".equalsIgnoreCase(uri.getHost()) || uri.getUserInfo() != null
                    || uri.getFragment() != null || (uri.getPort() != -1 && uri.getPort() != 443)) throw new IllegalArgumentException();
            return uri.toASCIIString();
        } catch (Exception e) { throw new BadRequestException("Cổng thanh toán không trả về URL Sandbox hợp lệ."); }
    }

    private String createVNPay(Order o) {
        Map<String, String> params = new TreeMap<>();
        params.put("vnp_Version", VNPayConfig.VNP_VERSION); params.put("vnp_Command", VNPayConfig.VNP_COMMAND);
        params.put("vnp_TmnCode", vnpay.getTmnCode()); params.put("vnp_Amount", Long.toString(o.amount().longValueExact() * 100));
        params.put("vnp_CurrCode", "VND"); params.put("vnp_TxnRef", o.orderId());
        params.put("vnp_OrderInfo", "Thanh toan ve " + o.code()); params.put("vnp_OrderType", VNPayConfig.VNP_ORDER_TYPE);
        params.put("vnp_Locale", "vn"); params.put("vnp_ReturnUrl", vnpay.getReturnUrl()); params.put("vnp_IpAddr", o.ip());
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
        params.put("vnp_CreateDate", formatter.format(LocalDateTime.now(clock))); params.put("vnp_ExpireDate", formatter.format(o.expiresAt()));
        String query = params.entrySet().stream().map(e -> URLEncoder.encode(e.getKey(), StandardCharsets.US_ASCII) + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.US_ASCII)).collect(java.util.stream.Collectors.joining("&"));
        return safeUrl(vnpay.getUrl() + "?" + query + "&vnp_SecureHash=" + VNPayConfig.hmacSHA512(vnpay.getHashSecret(), query), o.method());
    }

}
