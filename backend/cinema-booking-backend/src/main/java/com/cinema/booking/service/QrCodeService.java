package com.cinema.booking.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.EnumMap;
import java.util.Map;

/**
 * Service sinh ma QR Code bang Google ZXing (Cong viec 5.3).
 */
@Service
@Slf4j
public class QrCodeService {

    public static final int DEFAULT_WIDTH = 300;
    public static final int DEFAULT_HEIGHT = 300;

    /**
     * Sinh ma QR Code duoi dang byte array cua anh PNG.
     *
     * @param text Noi dung ma hoa (VD: bookingCode)
     * @param width Chieu rong anh (pixel)
     * @param height Chieu cao anh (pixel)
     * @return Byte array cua anh PNG
     */
    public byte[] generateQrCodeImageBytes(String text, int width, int height) {
        try {
            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
            hints.put(EncodeHintType.CHARACTER_SET, StandardCharsets.UTF_8.name());
            hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.H);
            hints.put(EncodeHintType.MARGIN, 1);

            BitMatrix bitMatrix = qrCodeWriter.encode(text, BarcodeFormat.QR_CODE, width, height, hints);

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(bitMatrix, "PNG", outputStream);
            return outputStream.toByteArray();
        } catch (Exception e) {
            log.error("Loi khi sinh ma QR cho noi dung '{}': {}", text, e.getMessage(), e);
            throw new RuntimeException("Khong the sinh ma QR: " + e.getMessage(), e);
        }
    }

    /**
     * Sinh ma QR Code mac dinh (300x300).
     */
    public byte[] generateQrCodeImageBytes(String text) {
        return generateQrCodeImageBytes(text, DEFAULT_WIDTH, DEFAULT_HEIGHT);
    }

    /**
     * Sinh ma QR Code duoi dang chuoi Base64 Data URI.
     * Dinh dang: data:image/png;base64,...
     */
    public String generateQrCodeBase64(String text, int width, int height) {
        byte[] imageBytes = generateQrCodeImageBytes(text, width, height);
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(imageBytes);
    }

    public String generateQrCodeBase64(String text) {
        return generateQrCodeBase64(text, DEFAULT_WIDTH, DEFAULT_HEIGHT);
    }
}