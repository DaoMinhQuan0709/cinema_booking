package com.cinema.booking.service;

import com.cinema.booking.entity.Booking;
import com.cinema.booking.entity.BookingProduct;
import com.cinema.booking.entity.BookingSeat;
import com.cinema.booking.entity.Seat;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * Service gui email thong bao va xac nhan ve kem anh ma QR (Cong viec 5.3).
 */
@Service
@Slf4j
public class EmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String mailFrom;

    /**
     * Gui email xac nhan dat ve thanh cong kem ma QR nhung inline (CID).
     *
     * @param booking     Don dat ve
     * @param qrCodeBytes Byte array anh QR Code PNG
     */
    public void sendTicketConfirmationEmail(Booking booking, byte[] qrCodeBytes) {
        String recipientEmail = booking.getUser().getEmail();
        String bookingCode = booking.getBookingCode();

        log.info("Bat dau chuan bi email xac nhan ve: to={}, bookingCode={}", recipientEmail, bookingCode);

        if (mailSender == null || mailFrom == null || mailFrom.trim().isEmpty()) {
            log.warn("JavaMailSender hoac spring.mail.username chua duoc cau hinh. Bo qua buoc gui email thuc te. [Dev Simulation mode]");
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(mailFrom, "Cinema Booking");
            helper.setTo(recipientEmail);
            helper.setSubject("🎟️ [Cinema Booking] Vé xem phim điện tử của bạn - Mã: " + bookingCode);

            String htmlContent = buildTicketHtml(booking);
            helper.setText(htmlContent, true);

            // Nhung anh QR Code inline vao email bang Content-ID (CID)
            if (qrCodeBytes != null && qrCodeBytes.length > 0) {
                helper.addInline("qrCodeImage", new ByteArrayResource(qrCodeBytes), "image/png");
            }

            mailSender.send(message);
            log.info("Gui email ve dien tu thanh cong toi: {}", recipientEmail);

        } catch (Exception e) {
            log.error("Loi khi gui email ve dien tu toi {}: {}. Vui long kiem tra cau hinh SMTP.",
                    recipientEmail, e.getMessage());
        }
    }

    private String buildTicketHtml(Booking booking) {
        DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("HH:mm - dd/MM/yyyy");
        NumberFormat currencyFormatter = NumberFormat.getCurrencyInstance(new Locale("vi", "VN"));

        String seatsStr = booking.getBookingSeats().stream()
                .map(BookingSeat::getShowtimeSeat)
                .map(ss -> {
                    Seat s = ss.getSeat();
                    return s.getRowChar() + s.getSeatNumber();
                })
                .collect(Collectors.joining(", "));

        StringBuilder productsHtml = new StringBuilder();
        if (booking.getBookingProducts() != null && !booking.getBookingProducts().isEmpty()) {
            productsHtml.append("<div style='margin-top: 10px; padding: 10px; background-color: #f8f9fa; border-radius: 6px;'>");
            productsHtml.append("<strong>🍿 Bắp nước kèm theo:</strong><br/>");
            for (BookingProduct bp : booking.getBookingProducts()) {
                productsHtml.append("- ").append(bp.getProduct().getName())
                        .append(" x ").append(bp.getQuantity())
                        .append(" (").append(currencyFormatter.format(bp.getUnitPrice().multiply(java.math.BigDecimal.valueOf(bp.getQuantity())))).append(")<br/>");
            }
            productsHtml.append("</div>");
        }

        return "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;'>"
                + "<div style='background: linear-gradient(135deg, #e50914, #b81d24); padding: 20px; text-align: center; color: #ffffff;'>"
                + "<h1 style='margin: 0; font-size: 24px;'>CINEMA BOOKING</h1>"
                + "<p style='margin: 5px 0 0; font-size: 15px;'>VÉ XEM PHIM ĐIỆN TỬ</p>"
                + "</div>"
                + "<div style='padding: 24px; color: #333333; line-height: 1.6;'>"
                + "<p>Xin chào <strong>" + booking.getUser().getFullName() + "</strong>,</p>"
                + "<p>Cảm ơn bạn đã đặt vé xem phim tại Cinema Booking. Đơn đặt vé của bạn đã được thanh toán thành công!</p>"
                + "<div style='background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;'>"
                + "<h3 style='margin: 0 0 12px; color: #e50914; font-size: 18px;'>" + booking.getShowtime().getMovie().getTitle() + "</h3>"
                + "<p style='margin: 4px 0;'><strong>📍 Rạp:</strong> " + booking.getShowtime().getAuditorium().getCinema().getName() + " - " + booking.getShowtime().getAuditorium().getName() + "</p>"
                + "<p style='margin: 4px 0;'><strong>⏰ Suất chiếu:</strong> " + timeFormatter.format(booking.getShowtime().getStartTime()) + "</p>"
                + "<p style='margin: 4px 0;'><strong>💺 Ghế:</strong> " + seatsStr + "</p>"
                + "<p style='margin: 4px 0;'><strong>💳 Tổng thanh toán:</strong> " + currencyFormatter.format(booking.getTotalAmount()) + "</p>"
                + "<p style='margin: 4px 0;'><strong>🔢 Mã đặt vé:</strong> <span style='font-family: monospace; font-size: 16px; font-weight: bold; color: #111827;'>" + booking.getBookingCode() + "</span></p>"
                + productsHtml
                + "</div>"
                + "<div style='text-align: center; margin: 24px 0;'>"
                + "<p style='margin-bottom: 8px; font-size: 14px; color: #6b7280;'>Vui lòng xuất trình mã QR này tại quầy vé hoặc lối vào phòng chiếu:</p>"
                + "<img src='cid:qrCodeImage' alt='QR Code Vé Xem Phim' style='border: 4px solid #e50914; border-radius: 8px; width: 200px; height: 200px;' />"
                + "</div>"
                + "<p style='font-size: 13px; color: #9ca3af; text-align: center; margin-top: 24px;'>Chúc bạn có những giây phút thưởng thức phim tuyệt vời!</p>"
                + "</div>"
                + "</div>";
    }
}