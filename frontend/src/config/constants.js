/**
 * Hang so cau hinh dung chung cho toan frontend.
 * Doc tu bien moi truong Vite (file .env, xem .env.example o root frontend/).
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'http://localhost:8080/ws';

// Key luu tru trong localStorage (xem tokenStorage.js)
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'premier_cinema_access_token',
  REFRESH_TOKEN: 'premier_cinema_refresh_token',
  USER: 'premier_cinema_user',
};

// Khop enum showtime_seat_status ben backend (ARCHITECTURE.md)
export const SEAT_STATUS = {
  AVAILABLE: 'AVAILABLE',
  LOCKED: 'LOCKED',
  BOOKED: 'BOOKED',
};

// Khop enum seat_type ben backend
export const SEAT_TYPE = {
  STANDARD: 'STANDARD',
  VIP: 'VIP',
  COUPLE: 'COUPLE',
};

// Khop enum booking_status ben backend
export const BOOKING_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
};

// Khop enum user_role ben backend
export const USER_ROLE = {
  CUSTOMER: 'CUSTOMER',
  ADMIN: 'ADMIN',
};

// Thoi gian giu ghe (giay), khop application.booking.hold-seat-duration-seconds trong application.yml
export const HOLD_SEAT_DURATION_SECONDS = 600;

// So ghe toi da duoc chon 1 lan (theo dac ta man hinh chon ghe trong ke_hoach_frontend.md)
export const MAX_SEATS_PER_BOOKING = 8;

// Phuong thuc thanh toan ho tro
export const PAYMENT_METHOD = {
  VNPAY: 'VNPAY',
  MOMO: 'MOMO',
};
