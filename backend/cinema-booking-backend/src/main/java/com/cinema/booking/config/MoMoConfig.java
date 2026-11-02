package com.cinema.booking.config;

import com.cinema.booking.dto.request.MoMoIpnRequest;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

/**
 * Cau hinh va tien ich ky so cho cong thanh toan MoMo (HMAC-SHA256).
 */
@Configuration
@Getter
public class MoMoConfig {

    @Value("${application.payment.momo.partner-code:MOMO}")
    private String partnerCode;

    @Value("${application.payment.momo.access-key:F8BBA842ECF85}")
    private String accessKey;

    @Value("${application.payment.momo.secret-key:K951B6PE1waDMi640xX0hu2knHpBqDex}")
    private String secretKey;

    @Value("${application.payment.momo.endpoint:https://test-payment.momo.vn/v2/gateway/api/create}")
    private String endpoint;

    @Value("${application.payment.momo.return-url:http://localhost:5173/payment/momo-callback}")
    private String returnUrl;

    @Value("${application.payment.momo.ipn-url:http://localhost:8080/api/v1/payments/momo-ipn}")
    private String ipnUrl;

    /**
     * Tinh toan chu ky so HMAC-SHA256 cho MoMo.
     */
    public static String hmacSHA256(String key, String data) {
        try {
            if (key == null || data == null) {
                return "";
            }
            Mac hmac256 = Mac.getInstance("HmacSHA256");
            byte[] hmacKeyBytes = key.getBytes(StandardCharsets.UTF_8);
            SecretKeySpec secretKey = new SecretKeySpec(hmacKeyBytes, "HmacSHA256");
            hmac256.init(secretKey);
            byte[] dataBytes = data.getBytes(StandardCharsets.UTF_8);
            byte[] result = hmac256.doFinal(dataBytes);
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
     * Kiem tra chu ky so MoMo IPN (Signature Verification).
     */
    public boolean verifyIpnSignature(MoMoIpnRequest req) {
        if (req == null || req.getSignature() == null) {
            return false;
        }

        String rawSignature = "accessKey=" + this.accessKey +
                "&amount=" + req.getAmount() +
                "&extraData=" + (req.getExtraData() != null ? req.getExtraData() : "") +
                "&message=" + req.getMessage() +
                "&orderId=" + req.getOrderId() +
                "&orderInfo=" + req.getOrderInfo() +
                "&orderType=" + req.getOrderType() +
                "&partnerCode=" + req.getPartnerCode() +
                "&payType=" + req.getPayType() +
                "&requestId=" + req.getRequestId() +
                "&responseTime=" + req.getResponseTime() +
                "&resultCode=" + req.getResultCode() +
                "&transId=" + req.getTransId();

        String calculatedSignature = hmacSHA256(this.secretKey, rawSignature);
        return calculatedSignature.equalsIgnoreCase(req.getSignature());
    }
}