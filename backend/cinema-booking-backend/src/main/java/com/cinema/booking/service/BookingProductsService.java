package com.cinema.booking.service;

import com.cinema.booking.dto.request.BookingProductsRequest;
import com.cinema.booking.dto.response.BookingResponse;
import com.cinema.booking.entity.*;
import com.cinema.booking.enums.CheckoutState;
import com.cinema.booking.exception.*;
import com.cinema.booking.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.*;

@Service @RequiredArgsConstructor
public class BookingProductsService {
    private final BookingRepository bookings;
    private final ProductRepository products;
    private final CheckoutSupport checkout;
    private final BookingService bookingService;

    @Transactional
    public BookingResponse replace(String code, BookingProductsRequest request, String email) {
        Booking b = bookings.findByCodeForUpdate(code).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt vé."));
        checkout.authorize(b, email); checkout.requireLive(b); checkout.requireRevision(b, request.getExpectedRevision());
        if (checkout.view(b).getState() != CheckoutState.EDITABLE)
            throw new ConflictException("Đơn đã bắt đầu thanh toán. Không thể thay đổi combo.");
        Set<Long> seen = new HashSet<>();
        List<BookingProduct> replacement = new ArrayList<>();
        BigDecimal total = b.getBookingSeats().stream().map(BookingSeat::getPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
        for (var item : request.getProducts()) {
            if (item == null || item.getProductId() == null || item.getQuantity() == null || item.getQuantity() <= 0 || !seen.add(item.getProductId()))
                throw new BadRequestException("Combo hoặc số lượng không hợp lệ; không gửi sản phẩm trùng.");
            Product product = products.findById(item.getProductId()).orElseThrow(() -> new BadRequestException("Combo không còn tồn tại."));
            if (!Boolean.TRUE.equals(product.getIsAvailable())) throw new BadRequestException("Combo '" + product.getName() + "' đã ngừng bán. Vui lòng bỏ combo này.");
            BigDecimal price = CheckoutSupport.money(product.getPrice());
            total = total.add(price.multiply(BigDecimal.valueOf(item.getQuantity())));
            replacement.add(BookingProduct.builder().booking(b).product(product).unitPrice(price).quantity(item.getQuantity()).build());
        }
        b.setTotalAmount(CheckoutSupport.money(total));
        b.getBookingProducts().clear(); b.getBookingProducts().addAll(replacement);
        bookings.flush();
        return bookingService.getBookingByCode(code, email);
    }
}
