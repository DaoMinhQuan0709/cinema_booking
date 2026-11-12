package com.cinema.booking.repository;

import java.math.BigDecimal;

public interface RevenueTotals {
    BigDecimal getRevenue();
    Long getBookingCount();
    Long getTicketCount();
}
