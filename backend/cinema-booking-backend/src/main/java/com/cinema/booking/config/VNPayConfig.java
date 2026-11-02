package com.cinema.booking.config;

import jakarta.servlet.http.HttpServletRequest;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Cau hinh va tien ich ky so cho cong thanh toan VNPay (HMAC-SHA512).
 */
@Configuration
@Getter
public class VNPayConfig {

    @Value("${application.payment.vnpay.tmn-code:2QXUI4J4}")
    private String tmnCode;

    @Value("${application.payment.vnpay.hash-secret:RAOJPVRPKZSIIKNLQUXRVTXECTMVNXZG}")
    private String hashSecret;

    @Value("${application.payment.vnpay.url:https://sandbox.vnpayment.vn/paymentv2/vpcpay.html}")
    private String url;

    @Value("${application.payment.vnpay.return-url:http://localhost:5173/payment/vnpay-callback}")
    private String returnUrl;

    public static final String VNP_VERSION = "2.1.0";
    public static final String VNP_COMMAND = "pay";
    public static final String VNP_CURR_CODE = "VND";
    public static final String VNP_LOCALE = "vn";
    public static final String VNP_ORDER_TYPE = "other";

    /**
     * Tinh toan chu ky so HMAC-SHA512 cho VNPay.
     */
    public static String hmacSHA512(String key, String data) {
        try {
            if (key == null || data == null) {
                return "";
            }
            Mac hmac512 = Mac.getInstance("HmacSHA512");
            byte[] hmacKeyBytes = key.getBytes(StandardCharsets.UTF_8);
            SecretKeySpec secretKey = new SecretKeySpec(hmacKeyBytes, "HmacSHA512");
            hmac512.init(secretKey);
            byte[] dataBytes = data.getBytes(StandardCharsets.UTF_8);
            byte[] result = hmac512.doFinal(dataBytes);
            StringBuilder sb = new StringBuilder(2 * result.length);
            for (byte b : result) {
                sb.append(String.format("%02x", b & 0xff));
            }
            return sb.toString();
        } catch (Exception ex) {
            return "";
        }
    }

    /**
     * Kiem tra chu ky so VNPay IPN (Signature Verification).
     */
    public boolean verifyIpnChecksum(Map<String, String> params) {
        String secureHash = params.get("vnp_SecureHash");
        if (secureHash == null || secureHash.isEmpty()) {
            return false;
        }

        Map<String, String> vnp_Params = new HashMap<>();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();
            if (key != null && key.startsWith("vnp_") && !key.equals("vnp_SecureHash") && !key.equals("vnp_SecureHashType")) {
                if (value != null && !value.isEmpty()) {
                    vnp_Params.put(key, value);
                }
            }
        }

        List<String> fieldNames = new ArrayList<>(vnp_Params.keySet());
        Collections.sort(fieldNames);

        StringBuilder hashData = new StringBuilder();
        try {
            Iterator<String> itr = fieldNames.iterator();
            while (itr.hasNext()) {
                String fieldName = itr.next();
                String fieldValue = vnp_Params.get(fieldName);
                hashData.append(fieldName);
                hashData.append('=');
                hashData.append(URLEncoder.encode(fieldValue, StandardCharsets.US_ASCII.toString()));
                if (itr.hasNext()) {
                    hashData.append('&');
                }
            }

            String calculatedHash = hmacSHA512(this.hashSecret, hashData.toString());
            return calculatedHash.equalsIgnoreCase(secureHash);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Lay dia chi IP cua client tu HttpServletRequest.
     */
    public static String getIpAddress(HttpServletRequest request) {
        String ipAddress = request.getHeader("X-FORWARDED-FOR");
        if (ipAddress == null || ipAddress.isEmpty() || "unknown".equalsIgnoreCase(ipAddress)) {
            ipAddress = request.getHeader("Proxy-Client-IP");
        }
        if (ipAddress == null || ipAddress.isEmpty() || "unknown".equalsIgnoreCase(ipAddress)) {
            ipAddress = request.getHeader("WL-Proxy-Client-IP");
        }
        if (ipAddress == null || ipAddress.isEmpty() || "unknown".equalsIgnoreCase(ipAddress)) {
            ipAddress = request.getRemoteAddr();
        }
        if ("0:0:0:0:0:0:0:1".equals(ipAddress)) {
            ipAddress = "127.0.0.1";
        }
        if (ipAddress != null && ipAddress.contains(",")) {
            ipAddress = ipAddress.split(",")[0].trim();
        }
        return ipAddress != null ? ipAddress : "127.0.0.1";
    }
}