# KẾ HOẠCH THỰC HIỆN BACKEND (JAVA SPRING BOOT 3)
**Dự án:** Website Đặt vé xem phim (High-Concurrency System)  
**Tech Stack:** Java 17, Spring Boot 3.2+, PostgreSQL, Redis, Spring Security + JWT, Spring Data JPA, Google Gemini API, WebSocket (STOMP), ZXing, JavaMailSender.

---

## I. MỤC TIÊU VÀ NGUYÊN TẮC THIẾT KẾ

**Phạm vi dữ liệu Galaxy:** Phim, thông tin rạp/phòng và lịch chiếu được đồng bộ
định kỳ từ nguồn website; hiện giữ chu kỳ 5 phút sau khi lần đồng bộ trước kết
thúc. Sơ đồ ghế, giá vé, giữ chỗ, đơn hàng và thanh toán sandbox thuộc hệ thống
nội bộ. Không đồng bộ trạng thái ghế hoặc gửi lệnh giữ/xác nhận vé sang Galaxy.
Chi tiết và giới hạn được mô tả trong `ARCHITECTURE.md` (mục 0) và
`backend/cinema-booking-backend/GALAXY_SYNC.md`.

1. **Kiến trúc Layered Clean Architecture:** Phân tách rõ ràng các tầng Controller -> Service (Interface + Impl) -> Repository -> Entity/Model, sử dụng DTO và Mapper chuyên biệt.
2. **Xử lý Concurrency & Anti-Race Condition:** Áp dụng Two-Layer Locking (Redis Atomic / Distributed Lock làm phễu chặn tầng 1, Optimistic `@Version` hoặc Pessimistic `FOR UPDATE NOWAIT` tầng PostgreSQL làm chốt chặn tầng 2). Bắt buộc sắp xếp ID ghế tăng dần chống Deadlock.
3. **Chuẩn RESTful API & Error Handling:** 
   - Base URL: `/api/v1/...`
   - Phản hồi JSON theo định dạng chuẩn: `ApiResponse<T> { int code; String message; T data; }`
   - Xử lý ngoại lệ tập trung bằng `@RestControllerAdvice`.
4. **Idempotency & Async Processing:**
   - Webhook IPN kiểm tra trạng thái trước khi cập nhật (Idempotent).
   - Tác vụ nặng (sinh QR Code ZXing, gửi email JavaMailSender) thực hiện bất đồng bộ (`@Async` / Event-driven).
5. **Real-time UX:** Sử dụng WebSocket STOMP broadcast trạng thái ghế tức thì giữa các người dùng cùng xem sơ đồ suất chiếu.

---

## II. LỘ TRÌNH TRIỂN KHAI THEO GIAI ĐOẠN (PHASED ROADMAP)

### GIAI ĐOẠN 1: Cấu hình Khung Dự án, Hạ tầng & CSDL (Phần móng)
- **Công việc 1.1:** Khởi tạo dự án Spring Boot 3 với dependencies:
  - `Spring Web`, `Spring Data JPA`, `Spring Security`, `Lombok`, `PostgreSQL Driver`, `Spring Data Redis`, `Validation`, `JavaMailSender`, `WebSocket`.
  - Thư viện hỗ trợ: `ZXing` (sinh QR Code), `MapStruct` (DTO mapping), `jjwt` (JWT).
- **Công việc 1.2:** Cấu hình file `application.yml` (Dev/Prod): cấu hình Datasource PostgreSQL, Redis Cache/Lock, JWT Secret, Mail, Gemini API Key.
- **Công việc 1.3:** Xây dựng Entity JPA & Schema DB (bám sát DBML trong `ARCHITECTURE.md`):
  - `User` (email, password_hash, full_name, phone, role).
  - `Movie`, `Cinema`, `Auditorium`, `Seat` (cấu hình vật lý).
  - `Showtime`, `ShowtimeSeat` (trọng tâm Concurrency: status `AVAILABLE/LOCKED/BOOKED`, `locked_by_user_id`, `locked_until`, `version`).
  - `Product` (bắp nước), `Booking`, `BookingSeat`, `BookingProduct`, `Payment`.
  - Khai báo các Unique & Composite Index: `(showtime_id, seat_id)`, `(movie_id, start_time)`, `(booking_id, showtime_seat_id)`.
- **Công việc 1.4:** Xây dựng khung tầng cơ sở hạ tầng dùng chung:
  - `ApiResponse<T>` chuẩn hóa response: `{ "code": 200, "message": "Success", "data": ... }`.
  - `GlobalExceptionHandler` bắt các lỗi: `ValidationException` (400), `ResourceNotFoundException` (404), `SeatConflictException` (409), `Exception` (500).

### GIAI ĐOẠN 2: Authentication, Authorization & User Module
- **Công việc 2.1:** Cấu hình Spring Security 6 (Stateless Session) với `JwtAuthenticationFilter`.
- **Công việc 2.2:** API Authentication:
  - `POST /api/v1/auth/register`: Đăng ký tài khoản (mã hóa mật khẩu bằng `BCryptPasswordEncoder`).
  - `POST /api/v1/auth/login`: Xác thực đăng nhập, phát hành Access Token & Refresh Token.
  - `POST /api/v1/auth/refresh`: Cấp mới Access Token bằng Refresh Token.
- **Công việc 2.3:** API User Profile & Lịch sử:
  - `GET /api/v1/users/me`: Xem thông tin cá nhân.
  - `GET /api/v1/users/me/bookings`: Xem danh sách vé đã đặt và trạng thái.

### GIAI ĐOẠN 3: Catalog Module (Phim, Rạp, Lịch chiếu & Bắp nước)
- **Công việc 3.1:** API Quản lý Phim & Rạp:
  - `GET /api/v1/movies`: Danh sách phim (hỗ trợ lọc theo `status`, `genre`, từ khóa, phân trang `Pageable`).
  - `GET /api/v1/movies/{id}`: Chi tiết phim kèm trailer.
  - `GET /api/v1/cinemas`: Danh sách cụm rạp (lọc theo `city`).
  - `GET /api/v1/products`: Danh sách combo bắp nước đang mở bán.
- **Công việc 3.2:** API Lịch chiếu & Sơ đồ ghế (Read Path):
  - `GET /api/v1/showtimes`: Lấy danh sách suất chiếu theo `movieId`, `cinemaId`, `date`.
  - `GET /api/v1/showtimes/{id}/seats`: Lấy sơ đồ ghế và trạng thái ghế:
    - Truy vấn danh sách ghế từ DB.
    - Dùng Redis `MGET` đọc các key `seat_lock:{showtimeId}:{showtimeSeatId}` của danh sách ghế đang xét để hợp nhất trạng thái `LOCKED`, không quét toàn bộ keyspace.

### GIAI ĐOẠN 4: Core Booking & Concurrency Module (Trọng tâm kỹ thuật)
- **Công việc 4.1: Write Path - Giữ ghế 10 phút & Tạo đơn hàng (Critical Section)**
  - Endpoint: `POST /api/v1/bookings`.
  - **Bước 1 (Anti-Deadlock):** Sắp xếp mảng `showtimeSeatIds` theo thứ tự tăng dần.
  - **Bước 2 (Tầng 1 - Redis Fast-Fail):** 
    - Thực thi lock nguyên tử: `SET seat_lock:{showtimeId}:{seatId} {userId} NX EX 600`.
    - Nếu thất bại: Rollback ngay các key Redis đã set của request này, trả về `409 Conflict`.
  - **Bước 3 (Tầng 2 - PostgreSQL Transaction):**
    - Mở `@Transactional`.
    - Truy vấn lock DB: `SELECT ... FROM showtime_seats WHERE id IN (...) AND status = 'AVAILABLE' FOR UPDATE NOWAIT` (hoặc kiểm tra Optimistic `@Version`).
    - Nếu số lượng ghế lấy được không khớp -> Ném ngoại lệ, rollback DB, xóa key Redis.
    - Cập nhật `showtime_seats` sang `LOCKED`, lưu thông tin `locked_by_user_id` và `locked_until`.
    - Tạo `Booking` trạng thái `PENDING` (hạn 10 phút), lưu `booking_seats` và `booking_products`.
  - **Bước 4 (Real-time):** Gửi thông báo WebSocket tới topic `/topic/showtimes/{showtimeId}/seats` để UI các client khác đổi màu ghế.
- **Công việc 4.2: Hủy giữ chỗ chủ động**
  - Endpoint: `DELETE /api/v1/bookings/{bookingCode}/cancel`.
  - Chuyển `Booking` sang `CANCELLED`, nhả ghế DB về `AVAILABLE`, xóa key Redis, broadcast WebSocket nhả ghế.
- **Công việc 4.3: Background Cleaner (Cronjob quét đơn hết hạn)**
  - Cấu hình `@Scheduled(fixedRate = 30000)`: Quét các đơn `PENDING` có `expires_at < NOW()`.
  - Chuyển `Booking` sang `EXPIRED`, đưa `showtime_seats` về `AVAILABLE`, dọn dẹp key Redis còn sót, broadcast WebSocket.

### GIAI ĐOẠN 5: Payment Gateway & Asynchronous Processing
- **Công việc 5.1:** Tích hợp cổng thanh toán Sandbox:
  - `POST /api/v1/payments/create-url`: Sinh URL thanh toán kèm chữ ký số (Checksum HMAC-SHA512) cho VNPay / MoMo.
- **Công việc 5.2: Xử lý Webhook IPN & Idempotency**
  - Endpoints: `GET /api/v1/payments/vnpay-ipn`, `POST /api/v1/payments/momo-ipn`.
  - Xác thực chữ ký số (Signature Verification).
  - Kiểm tra tính lũy đẳng: Nếu đơn đã thanh toán trước đó (`payment.status == SUCCESS`), return mã thành công ngay lập tức.
  - **Xử lý Edge Case thanh toán trễ (ở phút 10:01):**
    - Nếu `booking.status == 'PENDING'`: Đổi sang `CONFIRMED`, cập nhật ghế `BOOKED`, xóa key Redis.
    - Nếu `booking.status == 'EXPIRED'`: Kiểm tra ghế có còn `AVAILABLE` không. Nếu còn trống -> Cho phép `CONFIRMED`; nếu ghế đã bị người khác chọn -> Chuyển sang `REFUND_REQUIRED` để hoàn tiền.
- **Công việc 5.3: Dịch vụ Xử lý Bất đồng bộ (`@Async`)**
  - Sinh ảnh QR Code chứa `booking_code` bằng ZXing.
  - Upload ảnh QR lên dịch vụ lưu trữ (Cloudinary/S3).
  - Gửi Email xác nhận vé đính kèm mã QR bằng `JavaMailSender` trên luồng ngầm (Background Thread) mà không làm chậm phản hồi IPN của cổng thanh toán.

### GIAI ĐOẠN 6: Module Quản trị & Báo cáo Thống kê (Admin Portal) [HOÀN THÀNH]
- **Công việc 6.1:** CRUD Quản trị viên:
  - Quản lý phim: `POST /api/v1/admin/movies`, `PUT`, `DELETE`.
  - Quản lý rạp và phòng chiếu: `POST /api/v1/admin/cinemas`, `POST /api/v1/admin/cinemas/{cinemaId}/auditoriums`.
  - Khởi tạo sơ đồ ghế theo lô: `POST /api/v1/admin/auditoriums/{id}/seats/batch`.
  - Xếp lịch chiếu: `POST /api/v1/admin/showtimes` (tự động kiểm tra xung đột thời gian chiếu cùng phòng và tự động sinh bản ghi `showtime_seats`).
  - Quản lý bắp nước: `CRUD /api/v1/admin/products`.
- **Công việc 6.2:** Thống kê Doanh thu & Tỷ lệ lấp đầy:
  - `GET /api/v1/admin/reports/revenue`: Doanh thu theo khoảng thời gian, theo rạp hoặc theo phim.
  - `GET /api/v1/admin/reports/occupancy`: Thống kê tỷ lệ lấp đầy phòng chiếu (Occupancy Rate).

### GIAI ĐOẠN 7: Tích hợp Trợ lý AI (Google Gemini API) [HOÀN THÀNH]
- **Công việc 7.1:** Xây dựng `GeminiClientService` bằng Spring 3.2+ `RestClient`.
- **Công việc 7.2: Chatbot Tư vấn Lịch chiếu & Đặt vé**
  - Endpoint: `POST /api/v1/chat/ask`.
  - Truy vấn dữ liệu thực tế từ Database (Phim đang chiếu, khung giờ chiếu trong 3 ngày tới, combo bắp nước) để nạp vào System Prompt (Context Injection / RAG cơ bản) giúp AI trả lời chính xác, chống hallucination, kèm link và hướng dẫn người dùng chọn ghế trên website.

---

## III. BẢNG TỔNG HỢP RESTFUL API SPECIFICATION

| Module | Method | Endpoint | Quyền | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/auth/register` | Public | Đăng ký tài khoản mới |
| **Auth** | `POST` | `/api/v1/auth/login` | Public | Đăng nhập hệ thống (trả về JWT) |
| **Auth** | `POST` | `/api/v1/auth/refresh` | Public | Làm mới Access Token |
| **User** | `GET`  | `/api/v1/users/me` | Authenticated | Thông tin cá nhân người dùng |
| **User** | `GET`  | `/api/v1/users/me/bookings` | Authenticated | Lịch sử đơn đặt vé |
| **Catalog** | `GET` | `/api/v1/movies` | Public | Danh sách phim (lọc, phân trang) |
| **Catalog** | `GET` | `/api/v1/movies/{id}` | Public | Chi tiết phim và trailer |
| **Catalog** | `GET` | `/api/v1/cinemas` | Public | Danh sách cụm rạp |
| **Catalog** | `GET` | `/api/v1/showtimes` | Public | Tra cứu lịch chiếu theo phim/rạp/ngày |
| **Catalog** | `GET` | `/api/v1/showtimes/{id}/seats` | Public | Sơ đồ ghế và trạng thái real-time |
| **Catalog** | `GET` | `/api/v1/products` | Public | Danh sách bắp nước |
| **Booking** | `POST` | `/api/v1/bookings` | Customer | **Giữ ghế 10p & Tạo đơn (Lock 2 tầng)** |
| **Booking** | `GET`  | `/api/v1/bookings/{bookingCode}` | Customer | Chi tiết đơn đặt vé |
| **Booking** | `DELETE`| `/api/v1/bookings/{bookingCode}/cancel` | Customer | Hủy giữ chỗ chủ động |
| **Payment** | `POST` | `/api/v1/payments/create-url` | Customer | Khởi tạo link thanh toán VNPay / MoMo |
| **Payment** | `GET`  | `/api/v1/payments/vnpay-ipn` | Public | Webhook IPN xử lý kết quả VNPay |
| **Payment** | `POST` | `/api/v1/payments/momo-ipn` | Public | Webhook IPN xử lý kết quả MoMo |
| **AI** | `POST` | `/api/v1/chat/ask` | Public | Chatbot tư vấn chọn phim & lịch chiếu |
| **Admin** | `POST` | `/api/v1/admin/movies` | Admin | Quản lý phim |
| **Admin** | `POST` | `/api/v1/admin/cinemas` | Admin | Quản lý rạp và phòng chiếu |
| **Admin** | `POST` | `/api/v1/admin/auditoriums/{id}/seats/batch` | Admin | Khởi tạo sơ đồ ghế hàng loạt |
| **Admin** | `POST` | `/api/v1/admin/showtimes` | Admin | Xếp lịch chiếu (tự sinh showtime_seats) |
| **Admin** | `CRUD` | `/api/v1/admin/products` | Admin | Quản lý bắp nước |
| **Admin** | `GET`  | `/api/v1/admin/reports/revenue` | Admin | Báo cáo doanh thu |
| **Admin** | `GET`  | `/api/v1/admin/reports/occupancy` | Admin | Báo cáo tỷ lệ lấp đầy phòng chiếu |

---

## IV. QUY TRÌNH KIỂM THỬ VÀ ĐÁNH GIÁ (TESTING & CI/CD)
1. **Unit Test & Integration Test:** 
   - Sử dụng JUnit 5, Mockito và Testcontainers (PostgreSQL, Redis).
   - Kiểm thử kỹ lưỡng luồng Giữ ghế và Concurrency Transaction.
2. **Stress Testing / Load Testing (Đặc biệt quan trọng với Concurrency):** 
   - Dùng **k6** hoặc **Apache JMeter** viết kịch bản giả lập 500 - 1000 requests cùng bấm chọn tranh chấp 1 hoặc 2 ghế tại cùng một thời điểm.
   - Tiêu chí đánh giá (Pass criteria): Chỉ duy nhất 1 request thành công, các request còn lại nhận `409 Conflict` trong thời gian dưới 50ms (nhờ chặn ở tầng Redis), không xảy ra tình trạng Double Booking hoặc Deadlock DB.
3. **Deployment & CI/CD:** 
   - Dockerfile Multi-stage build cho Spring Boot tối ưu dung lượng image.
   - CSDL PostgreSQL (Supabase / Neon), Redis (Upstash / Docker).
   - Triển khai Backend lên Render / Railway / VPS với Docker Compose.
