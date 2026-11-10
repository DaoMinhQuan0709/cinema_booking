package com.cinema.booking.entity;

import com.cinema.booking.enums.CheckoutState;
import com.cinema.booking.enums.PaymentStatus;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payment_attempts", indexes = @Index(name = "idx_attempt_booking", columnList = "booking_id,id"))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PaymentAttempt {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;
    @Column(nullable = false, length = 10)
    private String method;
    @Column(nullable = false, length = 64)
    private String revision;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;
    @Column(name = "provider_order_id", nullable = false, unique = true, length = 100)
    private String providerOrderId;
    @Column(name = "request_id", nullable = false, unique = true, length = 64)
    private String requestId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private CheckoutState state;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private PaymentStatus outcome;
    @Column(name = "payment_url", columnDefinition = "text")
    private String paymentUrl;
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    @Column(name = "lease_until", nullable = false)
    private LocalDateTime leaseUntil;
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;
    @Version @Builder.Default @Column(nullable = false)
    private Integer version = 0;
}
