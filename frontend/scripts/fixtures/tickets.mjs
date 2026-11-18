export const ticketHistory = ['CONFIRMED', 'PENDING', 'CANCELLED', 'EXPIRED'].map((status, index) => ({
  id: index + 1, bookingCode: `BK20261109130000ABC${index ? index : 'D'}`, status,
  movieTitle: ['Dune: Hành Tinh Cát', 'Interstellar', 'Nhà Bà Nữ', 'Mắt Biếc'][index],
  cinemaName: 'Galaxy Nguyễn Du', auditoriumName: 'Phòng 03',
  showStartTime: '2026-12-20T19:30:00', createdAt: `2026-11-${18 - index}T10:00:00`,
  expiresAt: '2026-11-18T10:10:00', totalAmount: index === 0 ? 240000 : 180000,
  qrCodeUrl: 'https://should-never-load.example.invalid/ticket.png',
}));

export function ticketDetail(code) {
  const row = ticketHistory.find(item => item.bookingCode === code);
  if (!row) return null;
  return { id: row.id, bookingCode: code, status: row.status, totalAmount: row.totalAmount,
    createdAt: row.createdAt, expiresAt: row.expiresAt,
    serverTime: new Date().toISOString(), checkoutRevision: '0'.repeat(64),
    checkout: { state: 'EDITABLE', canEditProducts: true, expiresAt: new Date(Date.now() + 600000).toISOString() },
    showtime: { showtimeId: 501, movieTitle: row.movieTitle, cinemaName: row.cinemaName,
      auditoriumName: row.auditoriumName, startTime: row.showStartTime, endTime: '2026-12-20T22:00:00' },
    seats: [{ showtimeSeatId: 701, rowChar: 'D', seatNumber: 7, seatType: 'VIP', price: 90000 },
      { showtimeSeatId: 702, rowChar: 'D', seatNumber: 8, seatType: 'VIP', price: 90000 }],
    products: row.id === 1 ? [{ productId: 5, productName: 'Combo đôi', quantity: 2, unitPrice: 30000, subtotal: 60000 }] : [],
  };
}
