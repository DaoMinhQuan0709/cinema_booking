package com.cinema.booking;

import com.cinema.booking.entity.Booking;
import com.cinema.booking.entity.User;
import com.cinema.booking.enums.BookingStatus;
import com.cinema.booking.enums.UserRole;
import com.cinema.booking.exception.ConflictException;
import com.cinema.booking.exception.ForbiddenException;
import com.cinema.booking.exception.ResourceNotFoundException;
import com.cinema.booking.repository.BookingRepository;
import com.cinema.booking.repository.UserRepository;
import com.cinema.booking.service.QrCodeService;
import com.cinema.booking.service.impl.BookingServiceImpl;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Actual ownership/status checks and ZXing encoding; repositories are in-memory mocks. */
@MockitoSettings(strictness = Strictness.LENIENT)
class BookingQrServiceTests {
    private static final String CODE = "BK20261120130000ABCD";
    @Mock private BookingRepository bookings;
    @Mock private UserRepository users;
    @Mock private QrCodeService qr;
    @InjectMocks private BookingServiceImpl service;
    private Booking booking;

    @BeforeEach
    void setUp() {
        var owner = User.builder().id(1L).email("owner@example.invalid").role(UserRole.CUSTOMER).build();
        booking = Booking.builder().bookingCode(CODE).user(owner).status(BookingStatus.CONFIRMED).build();
        when(bookings.findByBookingCode(CODE)).thenReturn(Optional.of(booking));
        when(users.findByEmail(owner.getEmail())).thenReturn(Optional.of(owner));
    }

    @Test
    void ownerReceivesDecodablePngContainingTheUnchangedBookingCode() throws Exception {
        when(qr.generateQrCodeImageBytes(CODE)).thenAnswer(invocation -> new QrCodeService().generateQrCodeImageBytes(CODE));
        byte[] png = service.getBookingQrCode(CODE, "owner@example.invalid");
        assertArrayEquals(new byte[]{(byte) 137, 80, 78, 71, 13, 10, 26, 10}, java.util.Arrays.copyOf(png, 8));
        var image = ImageIO.read(new ByteArrayInputStream(png));
        assertNotNull(image);
        assertEquals(300, image.getWidth());
        assertEquals(300, image.getHeight());
        var decoded = new MultiFormatReader().decode(new BinaryBitmap(new HybridBinarizer(new BufferedImageLuminanceSource(image))));
        assertEquals(CODE, decoded.getText());
        verify(qr).generateQrCodeImageBytes(CODE);
    }

    @Test
    void adminMayReadAnotherOwnersConfirmedQr() {
        var admin = User.builder().id(2L).role(UserRole.ADMIN).build();
        when(users.findByEmail("admin@example.invalid")).thenReturn(Optional.of(admin));
        byte[] png = {1, 2};
        when(qr.generateQrCodeImageBytes(CODE)).thenReturn(png);
        assertSame(png, service.getBookingQrCode(CODE, "admin@example.invalid"));
    }

    @ParameterizedTest
    @EnumSource(BookingStatus.class)
    void otherCustomersAreForbiddenForEveryStatusBeforeAnyQrIsGenerated(BookingStatus status) {
        booking.setStatus(status);
        when(users.findByEmail("other@example.invalid")).thenReturn(Optional.of(User.builder().id(3L).role(UserRole.CUSTOMER).build()));
        assertThrows(ForbiddenException.class, () -> service.getBookingQrCode(CODE, "other@example.invalid"));
        verifyNoInteractions(qr);
    }

    @ParameterizedTest
    @EnumSource(value = BookingStatus.class, names = {"PENDING", "CANCELLED", "EXPIRED"})
    void ownersAndAdminsCannotGetQrForUnconfirmedOrders(BookingStatus status) {
        booking.setStatus(status);
        when(users.findByEmail("admin@example.invalid")).thenReturn(Optional.of(User.builder().id(2L).role(UserRole.ADMIN).build()));
        for (String email : new String[]{"owner@example.invalid", "admin@example.invalid"}) {
            assertThrows(ConflictException.class, () -> service.getBookingQrCode(CODE, email));
        }
        verifyNoInteractions(qr);
    }

    @Test
    void nonexistentBookingNeverGeneratesArbitraryQr() {
        when(bookings.findByBookingCode("missing")).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> service.getBookingQrCode("missing", "owner@example.invalid"));
        verifyNoInteractions(qr);
    }
}
