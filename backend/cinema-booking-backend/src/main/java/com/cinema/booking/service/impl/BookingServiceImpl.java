package com.cinema.booking.service.impl;

import com.cinema.booking.dto.request.BookingCreateRequest;
import com.cinema.booking.dto.request.BookingProductItem;
import com.cinema.booking.dto.response.BookingResponse;
import com.cinema.booking.entity.*;
import com.cinema.booking.enums.BookingStatus;
import com.cinema.booking.enums.ShowtimeSeatStatus;
import com.cinema.booking.exception.BadRequestException;
import com.cinema.booking.exception.ForbiddenException;
import com.cinema.booking.exception.ResourceNotFoundException;
import com.cinema.booking.exception.SeatConflictException;
import com.cinema.booking.repository.*;
import com.cinema.booking.service.BookingService;
import com.cinema.booking.service.SeatLockService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * CORE LOGIC: Tao don dat ve voi co che Two-Layer Locking.
 *
 * Buoc 1 (Anti-Deadlock): Sap xep showtimeSeatIds tang dan.
 * Buoc 2 (Tang 1 - Redis Fast-Fail): SET NX EX 600 tren tung ghe.
 *         Neu that bai -> rollback Redis keys -> 409 Conflict.
 * Buoc 3 (Tang 2 - PostgreSQL Transaction):
 *         SELECT ... FOR UPDATE NOWAIT -> cap nhat ghe LOCKED -> tao Booking PENDING.
 *         Neu that bai -> rollback DB (tu dong) + xoa Redis keys -> 409 Conflict.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BookingServiceImpl implements BookingService {

    private final BookingRepository bookingRepository;
    private final ShowtimeSeatRepository showtimeSeatRepository;
    private final ShowtimeRepository showtimeRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final SeatLockService seatLockService;

    @Value("${application.booking.hold-seat-duration-seconds:600}")
    private long holdDurationSeconds;

    @Override
    @Transactional
    public BookingResponse createBooking(BookingCreateRequest request, String userEmail) {
        log.info("=== BAT DAU TAO DON DAT VE === userEmail={}, showtimeId={}, seats={}",
                userEmail, request.getShowtimeId(), request.getShowtimeSeatIds());

        // --- Validate co ban ---
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay nguoi dung"));

        Showtime showtime = showtimeRepository.findById(request.getShowtimeId())
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay suat chieu voi ID: " + request.getShowtimeId()));

        // Kiem tra suat chieu da qua gio chua
        if (showtime.getStartTime().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Suat chieu da bat dau hoac da ket thuc, khong the dat ve");
        }

        // Kiem tra nguoi dung co don PENDING cho cung suat chieu khong
        if (bookingRepository.existsPendingBookingByUserAndShowtime(user.getId(), showtime.getId())) {
            throw new BadRequestException("Ban da co don dat ve dang cho thanh toan cho suat chieu nay. Vui long thanh toan hoac huy don cu truoc.");
        }

        // ================================================================
        // BUOC 1: SAP XEP seatIds TANG DAN (Anti-Deadlock)
        // ================================================================
        List<Long> sortedSeatIds = request.getShowtimeSeatIds().stream()
                .distinct()
                .sorted()
                .collect(Collectors.toList());

        if (sortedSeatIds.isEmpty()) {
            throw new BadRequestException("Phai chon it nhat 1 ghe");
        }

        log.info("Buoc 1 - Anti-Deadlock: Sap xep {} seatIds tang dan: {}", sortedSeatIds.size(), sortedSeatIds);

        // ================================================================
        // BUOC 2: REDIS FAST-FAIL (Tang 1)
        // SET seat_lock:{showtimeId}:{seatId} {userId} NX EX 600
        // ================================================================
        boolean redisLockSuccess = seatLockService.lockSeats(
                showtime.getId(), sortedSeatIds, user.getId());

        if (!redisLockSuccess) {
            log.warn("Buoc 2 - Redis LOCK THAT BAI: Co ghe da bi nguoi khac giu. showtimeId={}, userId={}",
                    showtime.getId(), user.getId());
            throw new SeatConflictException("Ghe ban chon da co nguoi nhanh tay hon giu cho. Vui long chon ghe khac.");
        }

        log.info("Buoc 2 - Redis LOCK THANH CONG: {} ghe cho userId={}", sortedSeatIds.size(), user.getId());

        // ================================================================
        // BUOC 3: POSTGRESQL PESSIMISTIC LOCK (Tang 2)
        // SELECT ... FOR UPDATE NOWAIT
        // ================================================================
        try {
            // Truy van lock DB: chi lay ghe AVAILABLE, lock row ngay lap tuc
            List<ShowtimeSeat> availableSeats = showtimeSeatRepository
                    .findAvailableSeatsForUpdateNowait(sortedSeatIds);

            // Kiem tra so luong ghe lay duoc co khop voi yeu cau
            if (availableSeats.size() != sortedSeatIds.size()) {
                // Tim ghe bi thieu de bao loi cu the
                Set<Long> foundIds = availableSeats.stream()
                        .map(ShowtimeSeat::getId)
                        .collect(Collectors.toSet());
                List<Long> missingSeatIds = sortedSeatIds.stream()
                        .filter(id -> !foundIds.contains(id))
                        .collect(Collectors.toList());

                log.warn("Buoc 3 - DB LOCK THAT BAI: Ghe khong AVAILABLE. missing={}", missingSeatIds);

                // Rollback Redis keys
                seatLockService.unlockSeats(showtime.getId(), sortedSeatIds);
                throw new SeatConflictException(
                        "Mot so ghe khong con trong (IDs: " + missingSeatIds + "). Vui long chon ghe khac.");
            }

            log.info("Buoc 3 - DB LOCK THANH CONG: {} ghe AVAILABLE da duoc lock", availableSeats.size());

            // --- Cap nhat trang thai ghe sang LOCKED ---
            LocalDateTime lockedUntil = LocalDateTime.now().plusSeconds(holdDurationSeconds);
            for (ShowtimeSeat seat : availableSeats) {
                seat.setStatus(ShowtimeSeatStatus.LOCKED);
                seat.setLockedByUser(user);
                seat.setLockedUntil(lockedUntil);
            }
            showtimeSeatRepository.saveAll(availableSeats);

            // --- Tinh tong tien ghe ---
            BigDecimal seatTotal = availableSeats.stream()
                    .map(ShowtimeSeat::getPrice)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            // --- Xu ly san pham bap nuoc (neu co) ---
            List<BookingProduct> bookingProducts = new ArrayList<>();
            BigDecimal productTotal = BigDecimal.ZERO;

            if (request.getProducts() != null && !request.getProducts().isEmpty()) {
                // Lay tat ca product tu DB mot lan (batch query)
                List<Long> productIds = request.getProducts().stream()
                        .map(BookingProductItem::getProductId)
                        .collect(Collectors.toList());
                Map<Long, Product> productMap = productRepository.findAllById(productIds).stream()
                        .collect(Collectors.toMap(Product::getId, p -> p));

                for (BookingProductItem item : request.getProducts()) {
                    Product product = productMap.get(item.getProductId());
                    if (product == null) {
                        // Rollback Redis + DB se tu rollback vi @Transactional
                        seatLockService.unlockSeats(showtime.getId(), sortedSeatIds);
                        throw new ResourceNotFoundException("Khong tim thay san pham voi ID: " + item.getProductId());
                    }
                    if (!product.getIsAvailable()) {
                        seatLockService.unlockSeats(showtime.getId(), sortedSeatIds);
                        throw new BadRequestException("San pham '" + product.getName() + "' hien khong kha dung");
                    }

                    BigDecimal subtotal = product.getPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
                    productTotal = productTotal.add(subtotal);

                    bookingProducts.add(BookingProduct.builder()
                            .product(product)
                            .quantity(item.getQuantity())
                            .unitPrice(product.getPrice())
                            .build());
                }
            }

            BigDecimal totalAmount = seatTotal.add(productTotal);

            // --- Tao Booking ---
            String bookingCode = generateBookingCode();
            Booking booking = Booking.builder()
                    .bookingCode(bookingCode)
                    .user(user)
                    .showtime(showtime)
                    .totalAmount(totalAmount)
                    .status(BookingStatus.PENDING)
                    .expiresAt(lockedUntil)
                    .build();

            // --- Tao BookingSeats ---
            List<BookingSeat> bookingSeats = new ArrayList<>();
            for (ShowtimeSeat seat : availableSeats) {
                BookingSeat bs = BookingSeat.builder()
                        .booking(booking)
                        .showtimeSeat(seat)
                        .price(seat.getPrice())
                        .build();
                bookingSeats.add(bs);
            }
            booking.setBookingSeats(bookingSeats);

            // --- Gan BookingProducts vao Booking ---
            for (BookingProduct bp : bookingProducts) {
                bp.setBooking(booking);
            }
            booking.setBookingProducts(bookingProducts);

            // --- Luu Booking (cascade luu BookingSeats + BookingProducts) ---
            Booking savedBooking = bookingRepository.save(booking);

            log.info("=== TAO DON THANH CONG === bookingCode={}, totalAmount={}, expiresAt={}",
                    bookingCode, totalAmount, lockedUntil);

            return mapToBookingResponse(savedBooking, availableSeats);

        } catch (SeatConflictException | ResourceNotFoundException | BadRequestException e) {
            // Exception da biet -> re-throw (Redis da duoc rollback trong logic phia tren)
            throw e;
        } catch (Exception e) {
            // Exception bat ngo (VD: PessimisticLockException tu FOR UPDATE NOWAIT)
            log.error("Buoc 3 - EXCEPTION BAT NGO khi lock DB. Rollback Redis. Error: {}", e.getMessage());
            seatLockService.unlockSeats(showtime.getId(), sortedSeatIds);
            throw new SeatConflictException(
                    "Ghe ban chon dang duoc xu ly boi nguoi dung khac. Vui long thu lai sau giay lat.");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public BookingResponse getBookingByCode(String bookingCode, String userEmail) {
        Booking booking = bookingRepository.findByBookingCode(bookingCode)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay don dat ve voi ma: " + bookingCode));

        // Kiem tra quyen so huu
        if (!booking.getUser().getEmail().equals(userEmail)) {
            throw new ForbiddenException("Ban khong co quyen xem don dat ve nay");
        }

        // Lay thong tin ghe
        List<Long> seatIds = booking.getBookingSeats().stream()
                .map(bs -> bs.getShowtimeSeat().getId())
                .collect(Collectors.toList());
        List<ShowtimeSeat> seats = showtimeSeatRepository.findAllByIdIn(seatIds);

        return mapToBookingResponse(booking, seats);
    }

    // ========== Private Helper Methods ==========

    /**
     * Sinh ma booking unique: BK + yyyyMMddHHmmss + 4 ky tu random.
     * VD: BK20261027153045A7X2
     */
    private String generateBookingCode() {
        String timestamp = java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmss")
                .format(LocalDateTime.now());
        String random = UUID.randomUUID().toString().substring(0, 4).toUpperCase();
        return "BK" + timestamp + random;
    }

    /**
     * Map entity Booking sang BookingResponse DTO.
     */
    private BookingResponse mapToBookingResponse(Booking booking, List<ShowtimeSeat> showtimeSeats) {
        Showtime showtime = booking.getShowtime();

        // Map showtime info
        BookingResponse.ShowtimeInfo showtimeInfo = BookingResponse.ShowtimeInfo.builder()
                .showtimeId(showtime.getId())
                .movieTitle(showtime.getMovie().getTitle())
                .cinemaName(showtime.getAuditorium().getCinema().getName())
                .auditoriumName(showtime.getAuditorium().getName())
                .startTime(showtime.getStartTime())
                .endTime(showtime.getEndTime())
                .build();

        // Map seat info
        Map<Long, ShowtimeSeat> seatMap = showtimeSeats.stream()
                .collect(Collectors.toMap(ShowtimeSeat::getId, s -> s));

        List<BookingResponse.SeatInfo> seatInfos = booking.getBookingSeats().stream()
                .map(bs -> {
                    ShowtimeSeat ss = seatMap.get(bs.getShowtimeSeat().getId());
                    Seat seat = ss != null ? ss.getSeat() : bs.getShowtimeSeat().getSeat();
                    return BookingResponse.SeatInfo.builder()
                            .showtimeSeatId(bs.getShowtimeSeat().getId())
                            .rowChar(seat.getRowChar())
                            .seatNumber(seat.getSeatNumber())
                            .seatType(seat.getType().name())
                            .price(bs.getPrice())
                            .build();
                })
                .collect(Collectors.toList());

        // Map product info
        List<BookingResponse.ProductInfo> productInfos = booking.getBookingProducts().stream()
                .map(bp -> BookingResponse.ProductInfo.builder()
                        .productId(bp.getProduct().getId())
                        .productName(bp.getProduct().getName())
                        .quantity(bp.getQuantity())
                        .unitPrice(bp.getUnitPrice())
                        .subtotal(bp.getUnitPrice().multiply(BigDecimal.valueOf(bp.getQuantity())))
                        .build())
                .collect(Collectors.toList());

        return BookingResponse.builder()
                .id(booking.getId())
                .bookingCode(booking.getBookingCode())
                .status(booking.getStatus())
                .totalAmount(booking.getTotalAmount())
                .createdAt(booking.getCreatedAt())
                .expiresAt(booking.getExpiresAt())
                .showtime(showtimeInfo)
                .seats(seatInfos)
                .products(productInfos)
                .build();
    }
}

