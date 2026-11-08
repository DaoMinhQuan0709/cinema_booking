package com.cinema.booking.service.impl;

import com.cinema.booking.dto.request.BookingCreateRequest;
import com.cinema.booking.dto.request.BookingProductItem;
import com.cinema.booking.dto.response.BookingResponse;
import com.cinema.booking.entity.*;
import com.cinema.booking.enums.BookingStatus;
import com.cinema.booking.enums.ShowtimeSeatStatus;
import com.cinema.booking.enums.UserRole;
import com.cinema.booking.exception.BadRequestException;
import com.cinema.booking.exception.ForbiddenException;
import com.cinema.booking.exception.ResourceNotFoundException;
import com.cinema.booking.exception.SeatConflictException;
import com.cinema.booking.repository.*;
import com.cinema.booking.service.BookingService;
import com.cinema.booking.service.SeatLockService;
import com.cinema.booking.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

/**
 * CORE LOGIC: Module Booking
 *
 * 1. Tao don dat ve voi co che Two-Layer Locking (Cong viec 4.1):
 *    - Buoc 1 (Anti-Deadlock): Sap xep showtimeSeatIds tang dan.
 *    - Buoc 2 (Tang 1 - Redis Fast-Fail): SET NX EX 600 tren tung ghe.
 *    - Buoc 3 (Tang 2 - PostgreSQL Transaction): SELECT ... FOR UPDATE NOWAIT -> LOCKED.
 *    - Buoc 4 (Real-time): Broadcast WebSocket HOLD.
 *
 * 2. Huy giu cho chu dong (Cong viec 4.2):
 *    - Chuyen Booking sang CANCELLED.
 *    - Nha ghe DB ve AVAILABLE.
 *    - Xoa key Redis.
 *    - Broadcast WebSocket RELEASE.
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
    private final WebSocketService webSocketService;

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

        Showtime showtime = showtimeRepository.findByIdForBooking(request.getShowtimeId())
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay suat chieu voi ID: " + request.getShowtimeId()));

        if (!showtime.isActive()) {
            throw new BadRequestException("Suất chiếu không còn được mở bán. Vui lòng chọn suất chiếu khác.");
        }

        // Kiem tra suat chieu da qua gio chua
        if (!showtime.getStartTime().isAfter(LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")))) {
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
                List<Long> productIds = request.getProducts().stream()
                        .map(BookingProductItem::getProductId)
                        .collect(Collectors.toList());
                Map<Long, Product> productMap = productRepository.findAllById(productIds).stream()
                        .collect(Collectors.toMap(Product::getId, p -> p));

                for (BookingProductItem item : request.getProducts()) {
                    Product product = productMap.get(item.getProductId());
                    if (product == null) {
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

            // ================================================================
            // BUOC 4: BROADCAST WEBSOCKET REAL-TIME (HOLD)
            // ================================================================
            webSocketService.broadcastSeatHold(showtime.getId(), sortedSeatIds);

            log.info("=== TAO DON THANH CONG === bookingCode={}, totalAmount={}, expiresAt={}",
                    bookingCode, totalAmount, lockedUntil);

            return mapToBookingResponse(savedBooking, availableSeats);

        } catch (SeatConflictException | ResourceNotFoundException | BadRequestException e) {
            throw e;
        } catch (Exception e) {
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

        User currentUser = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay nguoi dung"));

        boolean isOwner = booking.getUser().getId().equals(currentUser.getId());
        boolean isAdmin = currentUser.getRole() == UserRole.ADMIN;

        if (!isOwner && !isAdmin) {
            throw new ForbiddenException("Ban khong co quyen xem don dat ve nay");
        }

        List<Long> seatIds = booking.getBookingSeats().stream()
                .map(bs -> bs.getShowtimeSeat().getId())
                .collect(Collectors.toList());
        List<ShowtimeSeat> seats = showtimeSeatRepository.findAllByIdIn(seatIds);

        return mapToBookingResponse(booking, seats);
    }

    @Override
    @Transactional
    public BookingResponse cancelBooking(String bookingCode, String userEmail) {
        log.info("=== BAT DAU HUY DON DAT VE === bookingCode={}, userEmail={}", bookingCode, userEmail);

        // 1. Tim booking
        Booking booking = bookingRepository.findByBookingCode(bookingCode)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay don dat ve voi ma: " + bookingCode));

        // 2. Kiem tra quyen so huu (Owner hoac ADMIN)
        User currentUser = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay nguoi dung"));

        boolean isOwner = booking.getUser().getId().equals(currentUser.getId());
        boolean isAdmin = currentUser.getRole() == UserRole.ADMIN;

        if (!isOwner && !isAdmin) {
            throw new ForbiddenException("Ban khong co quyen huy don dat ve nay");
        }

        // 3. Kiem tra trang thai don hang
        if (booking.getStatus() != BookingStatus.PENDING) {
            if (booking.getStatus() == BookingStatus.CONFIRMED) {
                throw new BadRequestException("Don dat ve da duoc thanh toan thanh cong, khong the huy giu cho");
            } else if (booking.getStatus() == BookingStatus.CANCELLED) {
                throw new BadRequestException("Don dat ve nay da duoc huy truoc do");
            } else if (booking.getStatus() == BookingStatus.EXPIRED) {
                throw new BadRequestException("Don dat ve da het han giu cho");
            } else {
                throw new BadRequestException("Khong the huy don dat ve o trang thai " + booking.getStatus());
            }
        }

        // 4. Cap nhat Booking sang CANCELLED
        booking.setStatus(BookingStatus.CANCELLED);
        Booking savedBooking = bookingRepository.save(booking);

        // 5. Lay danh sach ShowtimeSeat va nha ghe ve AVAILABLE tren DB
        List<Long> seatIds = booking.getBookingSeats().stream()
                .map(bs -> bs.getShowtimeSeat().getId())
                .collect(Collectors.toList());

        List<ShowtimeSeat> seats = showtimeSeatRepository.findAllByIdIn(seatIds);
        for (ShowtimeSeat seat : seats) {
            seat.setStatus(ShowtimeSeatStatus.AVAILABLE);
            seat.setLockedByUser(null);
            seat.setLockedUntil(null);
        }
        showtimeSeatRepository.saveAll(seats);

        Long showtimeId = booking.getShowtime().getId();

        // 6. Xoa key Redis (Fast-Fail Layer)
        seatLockService.unlockSeats(showtimeId, seatIds);

        // 7. Broadcast WebSocket real-time su kien nha ghe (RELEASE)
        webSocketService.broadcastSeatRelease(showtimeId, seatIds);

        log.info("=== HUY DON DAT VE THANH CONG === bookingCode={}, showtimeId={}, releasedSeats={}",
                bookingCode, showtimeId, seatIds);

        return mapToBookingResponse(savedBooking, seats);
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
