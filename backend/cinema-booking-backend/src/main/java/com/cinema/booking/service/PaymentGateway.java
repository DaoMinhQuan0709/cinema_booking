package com.cinema.booking.service;

import com.cinema.booking.config.*;
import com.cinema.booking.exception.BadRequestException;
import com.fasterxml.jackson.databind.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Component @RequiredArgsConstructor @Slf4j
public class PaymentGateway {
    private final VNPayConfig vnpay;
    private final MoMoConfig momo;
    private final Clock clock;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
    private final ObjectMapper json = new ObjectMapper();

    public record Order(String code, String method, BigDecimal amount, String orderId, String requestId, LocalDateTime expiresAt, String ip) { }

    public void validate(String method) {
        if (!Set.of("VNPAY", "MOMO").contains(method)) throw new BadRequestException("Phương thức thanh toán không hợp lệ.");
        if ("VNPAY".equals(method)) {
            if (missingCredential(vnpay.getTmnCode()) || missingCredential(vnpay.getHashSecret()))
                throw new BadRequestException("VNPay Sandbox chưa được cấu hình. Cần cặp VNPAY_TMN_CODE và VNPAY_HASH_SECRET do VNPay cấp cho cùng một website.");
            if (!vnpay.getTmnCode().equals(vnpay.getTmnCode().strip()) || !vnpay.getHashSecret().equals(vnpay.getHashSecret().strip()))
                throw new BadRequestException("Cấu hình VNPay chứa khoảng trắng thừa ở đầu/cuối. Vui lòng kiểm tra lại mã website và khóa bí mật.");
            safeUrl(vnpay.getUrl(), method);
            return;
        }
        String secret = momo.getSecretKey();
        if (secret == null || secret.isBlank() || secret.toLowerCase(Locale.ROOT).contains("your-"))
            throw new BadRequestException("Cổng thanh toán Sandbox chưa được cấu hình.");
        safeUrl(momo.getEndpoint(), method);
    }

    private static boolean missingCredential(String value) {
        return value == null || value.isBlank() || value.toLowerCase(Locale.ROOT).contains("your-") || value.strip().startsWith("<");
    }

    public String create(Order order) throws Exception {
        return "VNPAY".equals(order.method()) ? createVNPay(order) : createMoMo(order);
    }

    public static String safeUrl(String url, String method) {
        try {
            URI uri = URI.create(url);
            String host = "VNPAY".equals(method) ? "sandbox.vnpayment.vn" : "test-payment.momo.vn";
            if (!"https".equals(uri.getScheme()) || !host.equalsIgnoreCase(uri.getHost()) || uri.getUserInfo() != null
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

    private String createMoMo(Order o) throws Exception {
        URI endpoint = URI.create(momo.getEndpoint());
        if (!"https".equals(endpoint.getScheme()) || !"test-payment.momo.vn".equals(endpoint.getHost()) || endpoint.getUserInfo() != null)
            throw new BadRequestException("Địa chỉ MoMo Sandbox không hợp lệ.");
        String raw = "accessKey=" + momo.getAccessKey() + "&amount=" + o.amount().longValueExact() + "&extraData=&ipnUrl=" + momo.getIpnUrl()
                + "&orderId=" + o.orderId() + "&orderInfo=Thanh toan ve " + o.code() + "&partnerCode=" + momo.getPartnerCode()
                + "&redirectUrl=" + momo.getReturnUrl() + "&requestId=" + o.requestId() + "&requestType=captureWallet";
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("partnerCode", momo.getPartnerCode()); body.put("requestId", o.requestId()); body.put("orderId", o.orderId());
        body.put("amount", o.amount().longValueExact()); body.put("orderInfo", "Thanh toan ve " + o.code());
        body.put("redirectUrl", momo.getReturnUrl()); body.put("ipnUrl", momo.getIpnUrl()); body.put("extraData", "");
        body.put("lang", "vi"); body.put("requestType", "captureWallet"); body.put("signature", MoMoConfig.hmacSHA256(momo.getSecretKey(), raw));
        HttpRequest request = HttpRequest.newBuilder(endpoint).timeout(Duration.ofSeconds(35)).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body), StandardCharsets.UTF_8)).build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() / 100 != 2) {
            log.warn("MoMo create returned HTTP status={}", response.statusCode());
            throw new IllegalStateException("Gateway HTTP failure");
        }
        JsonNode data = json.readTree(response.body());
        if (!data.path("resultCode").isInt() || data.path("resultCode").asInt() != 0)
            log.warn("MoMo create requires reconciliation: resultCode={}", data.path("resultCode").isInt() ? data.path("resultCode").asInt() : "invalid");
        if (!data.path("resultCode").isInt() || data.path("resultCode").asInt() != 0 || !o.orderId().equals(data.path("orderId").asText())
                || !o.requestId().equals(data.path("requestId").asText()) || !momo.getPartnerCode().equals(data.path("partnerCode").asText())
                || !data.path("amount").canConvertToLong() || data.path("amount").asLong() != o.amount().longValueExact())
            throw new IllegalStateException("Gateway result requires reconciliation");
        return safeUrl(data.path("payUrl").asText(), o.method());
    }
}
