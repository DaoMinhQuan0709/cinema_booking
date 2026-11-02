package com.cinema.booking.service;

import com.cinema.booking.entity.Booking;
import com.cinema.booking.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Service xu ly hau thanh toan bat dong bo (Async Ticket Fulfillment):
 * 1. Sinh anh ma QR Code bang ZXing
 * 2. Luu QR Code vao don dat ve
 * 3. Gui email xac nhan ve kem ma QR nhung
 *
 * Chay tren ThreadPool 'ticketTaskExecutor' rieng biet de khong block webhook IPN.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TicketFulfillmentService {

    private final BookingRepository bookingRepository;
    private final QrCodeService qrCodeService;
    private final EmailService emailService;

    @Async("ticketTaskExecutor")
    @Transactional
    public void fulfillTicketAsync(Long bookingId) {
        log.info("TicketFulfillmentService (Async): Bat dau xu ly ve cho bookingId={}", bookingId);

        Optional<Booking> bookingOpt = bookingRepository.findById(bookingId);
        if (bookingOpt.isEmpty()) {
            log.error("TicketFulfillmentService: Khong tim thay bookingId={}", bookingId);
            return;
        }
        Booking booking = bookingOpt.get();

        try {
            // 1. Sinh ma QR Code bang Google ZXing
            String bookingCode = booking.getBookingCode();
            byte[] qrBytes = qrCodeService.generateQrCodeImageBytes(bookingCode);
            String qrBase64 = qrCodeService.generateQrCodeBase64(bookingCode);

            // 2. Cap nhat duong dan/du lieu QR vao Booking
            booking.setQrCodeUrl(qrBase64);
            bookingRepository.save(booking);
            log.info("TicketFulfillmentService: Da sinh va cap nhat QR Code cho bookingCode={}", bookingCode);

            // 3. Gui email xac nhan ve kem ma QR nhung
            emailService.sendTicketConfirmationEmail(booking, qrBytes);
            log.info("TicketFulfillmentService: Hoan tat xu ly fulfillment cho bookingCode={}", bookingCode);

        } catch (Exception e) {
            log.error("TicketFulfillmentService: Loi khi xu ly ve cho bookingCode={}: {}",
                    booking.getBookingCode(), e.getMessage(), e);
        }
    }
}