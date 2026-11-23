package com.cinema.booking.service;

import com.cinema.booking.dto.response.BookingResponse;
import com.cinema.booking.entity.Booking;
import com.cinema.booking.entity.Seat;
import com.cinema.booking.entity.Showtime;
import com.cinema.booking.entity.ShowtimeSeat;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class BookingResponseMapper {
    private final CheckoutSupport checkout;

    public BookingResponse toResponse(Booking booking, List<ShowtimeSeat> showtimeSeats) {
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
                .serverTime(checkout.instant())
                .checkoutRevision(checkout.revision(booking))
                .checkout(checkout.view(booking))
                .showtime(showtimeInfo)
                .seats(seatInfos)
                .products(productInfos)
                .build();
    }
}
