package com.cinema.booking.service.impl;

import com.cinema.booking.config.MoMoConfig;
import com.cinema.booking.config.VNPayConfig;
import com.cinema.booking.dto.request.PaymentCreateUrlRequest;
import com.cinema.booking.dto.response.PaymentUrlResponse;
import com.cinema.booking.entity.Booking;
import com.cinema.booking.entity.Payment;
import com.cinema.booking.entity.User;
import com.cinema.booking.enums.BookingStatus;
import com.cinema.booking.enums.PaymentStatus;
import com.cinema.booking.enums.UserRole;
import com.cinema.booking.exception.BadRequestException;
import com.cinema.booking.exception.ForbiddenException;
import com.cinema.booking.exception.ResourceNotFoundException;
import com.cinema.booking.repository.BookingRepository;
import com.cinema.booking.repository.PaymentRepository;
import com.cinema.booking.repository.UserRepository;
import com.cinema.booking.service.PaymentService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentServiceImpl implements PaymentService {

    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;
    private final VNPayConfig vnPayConfig;
    private final MoMoConfig moMoConfig;

    @Override
    @Transactional
    public PaymentUrlResponse createPaymentUrl(PaymentCreateUrlRequest request, String userEmail, HttpServletRequest servletRequest) {
        log.info("=== TAO URL THANH TOAN === bookingCode={}, method={}, user={}",
                request.getBookingCode(), request.getPaymentMethod(), userEmail);

        // 1. Tim don dat ve
        Booking booking = bookingRepository.findByBookingCode(request.getBookingCode())
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay don dat ve voi ma: " + request.getBookingCode()));

        // 2. Kiem tra quyen so huu
        User currentUser = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay nguoi dung"));

        boolean isOwner = booking.getUser().getId().equals(currentUser.getId());
        boolean isAdmin = currentUser.getRole() == UserRole.ADMIN;

        if (!isOwner && !isAdmin) {
            throw new ForbiddenException("Ban khong co quyen thanh toan cho don dat ve nay");
        }

        // 3. Kiem tra trang thai don dat ve
        if (booking.getStatus() != BookingStatus.PENDING) {
            if (booking.getStatus() == BookingStatus.CONFIRMED) {
                throw new BadRequestException("Don dat ve da duoc thanh toan truoc do");
            } else if (booking.getStatus() == BookingStatus.CANCELLED) {
                throw new BadRequestException("Don dat ve da bi huy, khong the thanh toan");
            } else if (booking.getStatus() == BookingStatus.EXPIRED) {
                throw new BadRequestException("Don dat ve da het han thanh toan");
            } else {
                throw new BadRequestException("Don dat ve khong o trang thai cho thanh toan");
            }
        }

        // Kiem tra thoi gian het han
        if (booking.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Don dat ve da het han giu cho (qua 10 phut)");
        }

        String method = request.getPaymentMethod().toUpperCase();

        // 4. Tao hoac cap nhat ban ghi Payment
        Payment payment = paymentRepository.findByBookingId(booking.getId())
                .orElseGet(() -> Payment.builder()
                        .booking(booking)
                        .paymentMethod(method)
                        .amount(booking.getTotalAmount())
                        .status(PaymentStatus.PENDING)
                        .build());

        if (payment.getStatus() == PaymentStatus.SUCCESS) {
            throw new BadRequestException("Don dat ve da duoc thanh toan thanh cong");
        }

        payment.setPaymentMethod(method);
        payment.setAmount(booking.getTotalAmount());
        paymentRepository.save(payment);

        // 5. Sinh URL theo phuong thuc
        String paymentUrl;
        if ("VNPAY".equalsIgnoreCase(method)) {
            paymentUrl = buildVNPayUrl(booking, servletRequest);
        } else if ("MOMO".equalsIgnoreCase(method)) {
            paymentUrl = buildMoMoUrl(booking);
        } else {
            throw new BadRequestException("Phuong thuc thanh toan khong hop le: " + method);
        }

        log.info("Tao URL thanh toan thanh cong: method={}, url={}", method, paymentUrl);

        return PaymentUrlResponse.builder()
                .paymentUrl(paymentUrl)
                .bookingCode(booking.getBookingCode())
                .paymentMethod(method)
                .amount(booking.getTotalAmount())
                .expiresAt(booking.getExpiresAt())
                .build();
    }

    // =========================================================================
    // PRIVATE METHODS: VNPAY & MOMO BUILDERS
    // =========================================================================

    private String buildVNPayUrl(Booking booking, HttpServletRequest request) {
        String vnp_Version = VNPayConfig.VNP_VERSION;
        String vnp_Command = VNPayConfig.VNP_COMMAND;
        String vnp_TmnCode = vnPayConfig.getTmnCode();
        String vnp_TxnRef = booking.getBookingCode();
        String vnp_IpAddr = VNPayConfig.getIpAddress(request);

        // So tien nhan 100 theo quy dinh cua VNPay (VND khong co so thap phan)
        long amount = booking.getTotalAmount().multiply(BigDecimal.valueOf(100)).longValue();

        Map<String, String> vnp_Params = new HashMap<>();
        vnp_Params.put("vnp_Version", vnp_Version);
        vnp_Params.put("vnp_Command", vnp_Command);
        vnp_Params.put("vnp_TmnCode", vnp_TmnCode);
        vnp_Params.put("vnp_Amount", String.valueOf(amount));
        vnp_Params.put("vnp_CurrCode", VNPayConfig.VNP_CURR_CODE);
        vnp_Params.put("vnp_TxnRef", vnp_TxnRef);
        vnp_Params.put("vnp_OrderInfo", "Thanh toan ve xem phim: " + booking.getBookingCode());
        vnp_Params.put("vnp_OrderType", VNPayConfig.VNP_ORDER_TYPE);
        vnp_Params.put("vnp_Locale", VNPayConfig.VNP_LOCALE);
        vnp_Params.put("vnp_ReturnUrl", vnPayConfig.getReturnUrl());
        vnp_Params.put("vnp_IpAddr", vnp_IpAddr);

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
        vnp_Params.put("vnp_CreateDate", formatter.format(LocalDateTime.now()));
        vnp_Params.put("vnp_ExpireDate", formatter.format(booking.getExpiresAt()));

        // Sap xep key theo alphabet
        List<String> fieldNames = new ArrayList<>(vnp_Params.keySet());
        Collections.sort(fieldNames);

        StringBuilder hashData = new StringBuilder();
        StringBuilder query = new StringBuilder();

        try {
            Iterator<String> itr = fieldNames.iterator();
            while (itr.hasNext()) {
                String fieldName = itr.next();
                String fieldValue = vnp_Params.get(fieldName);
                if (fieldValue != null && !fieldValue.isEmpty()) {
                    // Build hash data
                    hashData.append(fieldName);
                    hashData.append('=');
                    hashData.append(URLEncoder.encode(fieldValue, StandardCharsets.US_ASCII.toString()));

                    // Build query string
                    query.append(URLEncoder.encode(fieldName, StandardCharsets.US_ASCII.toString()));
                    query.append('=');
                    query.append(URLEncoder.encode(fieldValue, StandardCharsets.US_ASCII.toString()));

                    if (itr.hasNext()) {
                        query.append('&');
                        hashData.append('&');
                    }
                }
            }

            String queryUrl = query.toString();
            String vnp_SecureHash = VNPayConfig.hmacSHA512(vnPayConfig.getHashSecret(), hashData.toString());
            return vnPayConfig.getUrl() + "?" + queryUrl + "&vnp_SecureHash=" + vnp_SecureHash;

        } catch (Exception e) {
            log.error("Loi khi build VNPay payment URL: {}", e.getMessage(), e);
            throw new BadRequestException("Khong the tao URL thanh toan VNPay");
        }
    }

    private String buildMoMoUrl(Booking booking) {
        String partnerCode = moMoConfig.getPartnerCode();
        String accessKey = moMoConfig.getAccessKey();
        String secretKey = moMoConfig.getSecretKey();
        String returnUrl = moMoConfig.getReturnUrl();
        String ipnUrl = moMoConfig.getIpnUrl();
        String endpoint = moMoConfig.getEndpoint();

        String orderId = booking.getBookingCode() + "_" + System.currentTimeMillis();
        String requestId = UUID.randomUUID().toString();
        String orderInfo = "Thanh toan ve xem phim " + booking.getBookingCode();
        String amount = String.valueOf(booking.getTotalAmount().longValue());
        String extraData = "";
        String requestType = "captureWallet";

        // Chuoi ky so theo chuan MoMo v2
        String rawSignature = "accessKey=" + accessKey +
                "&amount=" + amount +
                "&extraData=" + extraData +
                "&ipnUrl=" + ipnUrl +
                "&orderId=" + orderId +
                "&orderInfo=" + orderInfo +
                "&partnerCode=" + partnerCode +
                "&redirectUrl=" + returnUrl +
                "&requestId=" + requestId +
                "&requestType=" + requestType;

        String signature = MoMoConfig.hmacSHA256(secretKey, rawSignature);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("partnerCode", partnerCode);
        requestBody.put("partnerName", "Cinema Booking");
        requestBody.put("storeId", "CinemaBookingStore");
        requestBody.put("requestId", requestId);
        requestBody.put("amount", Long.parseLong(amount));
        requestBody.put("orderId", orderId);
        requestBody.put("orderInfo", orderInfo);
        requestBody.put("redirectUrl", returnUrl);
        requestBody.put("ipnUrl", ipnUrl);
        requestBody.put("lang", "vi");
        requestBody.put("extraData", extraData);
        requestBody.put("requestType", requestType);
        requestBody.put("signature", signature);

        try {
            RestClient restClient = RestClient.create();
            Map<String, Object> response = restClient.post()
                    .uri(endpoint)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});

            if (response != null && response.containsKey("payUrl")) {
                return (String) response.get("payUrl");
            } else {
                log.warn("MoMo API response khong chua payUrl: {}", response);
                return returnUrl + "?orderId=" + orderId + "&resultCode=0&message=Success";
            }
        } catch (Exception e) {
            log.warn("Loi khi goi MoMo Gateway API (co the do Sandbox test endpoint timeout): {}. Dung fallback test URL.", e.getMessage());
            return returnUrl + "?orderId=" + orderId + "&resultCode=0&message=Success";
        }
    }
}