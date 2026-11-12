# KẾ HOẠCH PHÁT TRIỂN FRONTEND - PREMIERCINEMA (WEBSITE ĐẶT VÉ XEM PHIM CAO CẤP)
**Dự án:** Hệ thống Đặt vé xem phim High-Concurrency & Tích hợp Trợ lý AI  
**Mục đích tài liệu:** Đặc tả kỹ thuật đầy đủ (Single Source of Truth) để kỹ sư Frontend / AI Agent triển khai giao diện và kết nối 100% chính xác với Backend Spring Boot hiện có.

---

## I. TỔNG QUAN HỆ THỐNG & NGUYÊN TẮC THIẾT KẾ (DESIGN SYSTEM)

### 1. Phong cách Thiết kế (Cinematic Dark Mode)
Giao diện hướng tới trải nghiệm rạp chiếu phim hiện đại, sang trọng, tập trung vào hình ảnh poster sắc nét và sơ đồ phòng chiếu trực quan.

*   **Màu nền chính (Main Background):** `#0B0B0F` (Đen ánh xanh sâu thẳm, tạo chiều sâu).
*   **Màu thẻ / Khối nổi (Surface & Card):** `#16161E` (Xám đen) với viền mỏng `#262635`.
*   **Màu nhấn thương hiệu (Primary Accent):** `#E50914` hoặc `#FF2E4D` (Đỏ điện ảnh). Dùng cho nút CTA, trạng thái Hover, viền active, và **Ghế đang chọn**.
*   **Màu phân loại ghế (Seat Color Tokens):**
    *   *Ghế Thường (STANDARD):* `#3A3A4A` (Xám trung tính).
    *   *Ghế VIP:* `#F59E0B` (Vàng hổ phách ánh kim).
    *   *Ghế Đôi (COUPLE):* `#EC4899` (Hồng dạ quang).
    *   *Ghế đang chọn (SELECTED):* `#E50914` (Đỏ rực kèm hiệu ứng phát sáng nhẹ - glow).
    *   *Ghế đang bị người khác giữ (LOCKED):* `#6366F1` (Xanh tím pastel kèm icon ổ khóa).
    *   *Ghế đã bán (BOOKED):* `#1F1F28` (Xám tối, text mờ, con trỏ `not-allowed`).
*   **Typography:**
    *   Font chữ: `Inter`, `Roboto` hoặc `Plus Jakarta Sans`.
    *   Tiêu đề (Headings): Trắng tinh `#FFFFFF`, font-weight 700 - 800.
    *   Nội dung phụ (Muted Text): `#9E9EA7` (Tailwind: `text-neutral-400`).

### 2. Chiến lược Chuyển đổi Responsive (Mobile App -> Web Desktop)
*   **Desktop First với Mobile Friendly:** Đảm bảo trải nghiệm rộng rãi trên màn hình lớn (1280px - 1920px), đồng thời co giãn mượt mà trên Tablet và Mobile.
*   **Hero Showcase:** Banner phim thịnh hành full-width kèm nút xem Trailer popup (YouTube Embed) và nút "Đặt vé ngay".
*   **Sơ đồ phòng chiếu (Seat Matrix):** Thiết kế dạng màn hình cong (Curved Screen SVG). Cột bên phải (Sidebar Desktop) được ghim cố định (`sticky top-20`) hiển thị giỏ hàng, thông tin suất chiếu và **Đồng hồ đếm ngược 10 phút**.

---

## II. TECH STACK & CÔNG NGHỆ BẮT BUỘC

*   **Core Build Tool:** `React 18+` kết hợp `Vite` (tối ưu tốc độ HMR và bundle size).
*   **Styling:** `Tailwind CSS` + `clsx` + `tailwind-merge` để xử lý class linh hoạt.
*   **Routing:** `React Router DOM v6` (Hỗ trợ Protected Routes cho Customer và Admin).
*   **Quản lý Trạng thái (State Management):**
    *   `Zustand`: Quản lý Auth State (token, user profile), Booking State (suất chiếu, ghế đang chọn, bắp nước, timer).
    *   `TanStack React Query v5` (hoặc Custom Hooks): Quản lý cache và fetch dữ liệu phim/lịch chiếu.
*   **Giao tiếp HTTP & Interceptors:** `Axios` (Tự động đính kèm `Authorization: Bearer <token>`, bóc tách `ApiResponse<T>`, bắt lỗi 401 tự động logout/refresh token).
*   **Giao tiếp Thời gian thực (Real-time WebSockets):** `@stomp/stompjs` + `sockjs-client` (Bắt sự kiện ghế đổi màu real-time).
*   **Thư viện Hỗ trợ UI:**
    *   `lucide-react`: Bộ icon hiện đại, tối giản.
    *   `canvas-confetti`: Hiệu ứng pháo giấy rực rỡ khi thanh toán vé thành công.
    *   `react-toastify` hoặc `sonner`: Hiển thị thông báo toast đẹp mắt.

---

## III. CẤU TRÚC THƯ MỤC CHUẨN (FEATURE-FIRST ARCHITECTURE)

```
frontend/
├── public/                    # Favicon, logo PremierCinema, assets tĩnh
├── src/
│   ├── assets/                # Ảnh minh họa, logo SVG
│   ├── components/            # UI Components nguyên tử dùng chung
│   │   ├── ui/                # Button, Input, Modal, Badge, Spinner, Skeleton
│   │   └── common/            # Header, Footer, CurvedScreen, SeatLegend
│   ├── config/                # Axios instance, constants, WebSocket config
│   ├── features/              # Tổ chức theo tính năng nghiệp vụ
│   │   ├── auth/              # LoginModal, RegisterModal, authStore.js
│   │   ├── movies/            # MovieCard, MovieList, MovieDetail, TrailerModal
│   │   ├── booking/           # SeatGrid, CountdownTimer, BookingSummary, bookingStore.js
│   │   ├── payment/           # PaymentMethodSelector, PaymentCallbackView
│   │   ├── chatbot/           # CineBotFloatingWidget, ChatMessageItem
│   │   └── admin/             # MovieManager, ShowtimeManager, ReportDashboard, DataSync
│   ├── hooks/                 # useCountdown, useWebSocketSeatLock, useAuth
│   ├── layouts/               # MainLayout, AdminLayout, EmptyLayout
│   ├── routes/                # AppRoutes.jsx, ProtectedRoute.jsx, AdminRoute.jsx
│   ├── services/              # Tách riêng toàn bộ hàm gọi API (KHÔNG viết axios trong component)
│   │   ├── authService.js
│   │   ├── movieService.js
│   │   ├── showtimeService.js
│   │   ├── bookingService.js
│   │   ├── paymentService.js
│   │   ├── chatService.js
│   │   └── adminService.js
│   ├── utils/                 # formatCurrency (VND), formatDateTime, seatHelper
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── tailwind.config.js
└── package.json
```

---

## IV. HỢP ĐỒNG API VỚI BACKEND SPRING BOOT (API CONTRACTS)

*   **Base API URL:** `http://localhost:8080/api/v1`
*   **WebSocket Endpoint:** `http://localhost:8080/ws` (Topic: `/topic/showtimes/{showtimeId}/seats`)
*   **Chuẩn phản hồi chung (Uniform ApiResponse):**
    ```json
    {
      "code": 200,
      "message": "Success",
      "data": { ... } // hoặc array [...]
    }
    ```
*   **Cơ chế xác thực:** Truyền header `Authorization: Bearer <accessToken>` cho các API yêu cầu đăng nhập.

### Bảng Endpoint Trọng tâm Frontend cần kết nối:

| Module | Method | Endpoint | Quyền | Mô tả & Lưu ý Frontend |
| :--- | :---: | :--- | :---: | :--- |
| **Auth** | `POST` | `/auth/login` | Public | Body: `{ email, password }`. Trả về `accessToken`, `user` (id, email, role). |
| **Auth** | `POST` | `/auth/register` | Public | Body: `{ email, password, fullName, phone }`. |
| **User** | `GET` | `/users/me` | Customer | Lấy thông tin tài khoản đang đăng nhập. |
| **User** | `GET` | `/users/me/bookings`| Customer | Lấy danh sách lịch sử vé đã đặt. |
| **Catalog**| `GET` | `/movies?status=NOW_SHOWING` | Public | Lấy danh sách phim đang chiếu trang chủ. |
| **Catalog**| `GET` | `/movies?status=COMING_SOON` | Public | Lấy danh sách phim sắp chiếu. |
| **Catalog**| `GET` | `/movies/{id}` | Public | Chi tiết phim, trailer Youtube, thể loại, thời lượng. |
| **Catalog**| `GET` | `/showtimes?movieId=...&date=...` | Public | Lấy danh sách suất chiếu gom nhóm theo cụm rạp. |
| **Catalog**| `GET` | `/showtimes/{id}/seats` | Public | **Sơ đồ ghế**: Trả về danh sách ghế và trạng thái (`AVAILABLE`, `LOCKED`, `BOOKED`). |
| **Catalog**| `GET` | `/products` | Public | Lấy danh sách combo bắp nước bán kèm. |
| **Booking**| `POST`| `/bookings` | Customer | **Giữ ghế 10 phút**: Body: `{ showtimeId, showtimeSeatIds: [1,2], products: [...] }`. Trả về `bookingCode`, `expiresAt`, `totalAmount`. Bắt lỗi `409 Conflict` nếu có người nhanh tay hơn. |
| **Booking**| `DELETE`| `/bookings/{code}/cancel`| Customer | Hủy giữ chỗ chủ động khi bấm nút "Quay lại". |
| **Payment**| `POST`| `/payments/create-url` | Customer | Body: `{ bookingCode, paymentMethod: "VNPAY" \| "MOMO" }`. Trả về `paymentUrl` để redirect sang cổng thanh toán. |
| **Payment**| `GET` | *(Callback trang kết quả)* | Customer | Frontend bắt URL callback VNPay/MoMo để hiển thị vé và QR Code. |
| **AI Chat**| `POST`| `/chat/ask` | Public | Body: `{ message, conversationHistory: [] }`. Trợ lý ảo tư vấn lịch chiếu. |
| **Admin**  | `GET` | `/admin/reports/revenue` | Admin | Lọc doanh thu theo khoảng ngày, theo phim, theo rạp. |
| **Admin**  | `GET` | `/admin/reports/occupancy`| Admin | Thống kê tỷ lệ lấp đầy phòng chiếu (%). |
| **Admin**  | `POST`| `/admin/sync/galaxy/local-file` | Admin | Nút 1-click nạp sẵn dữ liệu rạp, phim thật từ Galaxy Cinema. |

---

## V. ĐẶC TẢ CHI TIẾT CÁC MÀN HÌNH CHÍNH (SCREEN SPECS)

### 1. Trang Chủ (Landing & Home Page - `/`)
*   **Header / Navbar:** Logo PremierCinema, menu điều hướng (Phim, Rạp, Giá vé, Khuyến mãi), thanh tìm kiếm phim, Nút Đăng nhập / Dropdown Profile (Avatar, Lịch sử vé, Nút Admin nếu `role === 'ADMIN'`).
*   **Hero Carousel / Banner:** Hiển thị 3-5 phim bom tấn nổi bật nhất (ảnh ngang chất lượng cao), nút xem nhanh Trailer popup và nút "Đặt Vé".
*   **Tabs Lọc Phim:** Tab "Phim Đang Chiếu" (`NOW_SHOWING`) và Tab "Phim Sắp Chiếu" (`COMING_SOON`).
*   **Movie Card Component:** Ảnh poster dọc tỷ lệ 2:3, nhãn độ tuổi (P, C13, C16, C18 viền đỏ nổi bật), thời lượng phim, tên phim, sao đánh giá, nút "Mua vé" dẫn tới trang chi tiết.
*   **Footer:** Thông tin bản quyền, quy định, đối tác thanh toán (VNPay, MoMo, Visa/Mastercard).

### 2. Trang Chi Tiết Phim & Chọn Suất Chiếu (`/movies/:id`)
*   **Banner Mờ (Backdrop Blur):** Ảnh nền mờ phía sau tạo cảm giác điện ảnh.
*   **Thông tin chi tiết:** Poster, Tiêu đề, Ngày khởi chiếu, Thể loại, Thời lượng, Mô tả nội dung phim, nhúng Video Trailer YouTube phát trực tiếp.
*   **Cụm Chọn Lịch Chiếu (Showtime Selector):**
    *   Thanh trượt chọn ngày chiếu (Hôm nay, Ngày mai, 5 ngày tiếp theo).
    *   Lọc theo Cụm rạp / Thành phố (TP.HCM, Hà Nội, Đà Nẵng...).
    *   Danh sách khung giờ chiếu (VD: `14:30`, `18:00`, `20:30` - kèm nhãn phòng 2D Phụ đề / IMAX). Nhấp vào giờ chiếu chuyển hướng ngay tới trang chọn ghế.

### 2.1. Trang Lịch Chiếu (`/showtimes`) — đã triển khai

*   Xem tất cả phim có suất mở bán trong ngày, kể cả phim sắp chiếu đang bán trước.
*   Chọn hôm nay và 6 ngày tiếp theo theo giờ Việt Nam; lọc thành phố, rạp và phim.
*   Gom theo phim → rạp → giờ, có poster, liên kết chi tiết và giá cơ bản từng suất.
*   Lưu ngày/bộ lọc trong URL; Back/Forward và quay lại từ booking giữ lựa chọn.
*   Mỗi ngày chỉ tải `GET /showtimes?date=YYYY-MM-DD`, tra thành phố qua `/cinemas`;
    cache/làm mới một phút, loại suất đã bắt đầu và hủy request ngày không còn xem.
*   Có skeleton, không có suất, lỗi/retry; API rạp lỗi không ngăn chọn suất.
*   Chỉ đọc catalog, không gọi API sơ đồ ghế khi xem lịch; giờ chiếu dẫn đến
    `/booking/:showtimeId` bằng ID số nội bộ. Hỗ trợ desktop/mobile và lazy-load.

Chi tiết thiết kế và kiểm chứng: `docs/plans/2026-11-08-showtimes-design.md`.

### 3. Trang Chọn Ghế & Giữ Ghế Thời Gian Thực (`/booking/:showtimeId`) - **TRỌNG TÂM KỸ THUẬT**

> Tiến độ phần dựng sơ đồ: đã có SVG màn hình, ma trận uốn cong, màu/trạng thái,
> chọn tối đa 8 ghế, bỏ chọn và tạm tính; hỗ trợ cuộn ngang trên điện thoại.
> Ghế đôi ghép hai vị trí liền kề thành khối rộng 2 ô, chọn/bỏ chọn cùng nhau
> và tính là 2 chỗ trong giới hạn 8; một bên không khả dụng sẽ khóa cả cặp.
> Route dùng `showtimes.id` nội bộ dạng số. Đã tích hợp WebSocket STOMP và nút
> “Tiếp tục” gọi API giữ ghế, yêu cầu đăng nhập, xử lý 409, xác nhận mã/thời hạn,
> hủy giữ chỗ và khôi phục bằng API khi tải lại trang. Đã nối sang Checkout,
> countdown server, combo và tạo URL thanh toán Sandbox ở mục 4.
> Trang kết quả VNPay ở mục 5 đã có; callback MoMo và vé QR là công việc tiếp theo.

*   **Màn hình chiếu cong (Curved Screen):** Đồ họa SVG vòm cong với dòng chữ sáng *"MÀN HÌNH"*.
*   **Ma trận ghế (Seat Matrix):**
    *   Render theo hàng A, B, C... và số ghế 1, 2, 3...
    *   Màu sắc chuẩn theo loại ghế: Standard (Xám), VIP (Vàng hổ phách), Couple (Hồng dạ quang).
    *   Xử lý click: Cho phép chọn tối đa 8 ghế/lần; khi chọn đổi sang màu Đỏ rực.
*   **Kết nối Real-time WebSocket (STOMP):**
    *   Subscribe kênh `/topic/showtimes/${showtimeId}/seats`.
    *   Khi nhận message có ghế vừa bị người khác lock hoặc mua: Ghế đó lập tức đổi sang màu tím khóa / xám bán và bị disable ngay trên màn hình mà không cần người dùng F5 tải lại trang.
*   **Sidebar Thông tin vé & Đồng hồ (Sticky Right):**
    *   Thông tin phim, rạp, phòng chiếu, giờ chiếu.
    *   Danh sách ghế đang chọn (VD: `VIP: F5, F6`).
    *   Tạm tính tổng tiền vé.
    *   Nút bấm **"Tiếp Tục"**: Gọi API `POST /api/v1/bookings` để thực hiện khóa ghế 10 phút. Nếu bị trùng ghế do người khác bấm trước -> Bắt lỗi `409` và hiển thị Toast *"Ghế bạn chọn vừa có người giữ chỗ!"*.
    *   **Đã triển khai:** nút khóa khi chưa chọn ghế/đang gửi; mở modal nếu chưa đăng nhập;
        gửi đủ hai vị trí ghế đôi, chặn bấm lặp và không tự retry POST. Khi giữ thành công,
        hiển thị mã đơn, hạn giữ và tổng tiền backend; phân biệt ghế “Đang giữ cho bạn”,
        có nút hủy để chọn lại. HTTP 409 hiện toast một lần và tải lại sơ đồ. Mã đơn
        lưu theo tài khoản/suất trong tab và được xác thực lại qua API khi tải lại trang.

### 4. Trang Chọn Bắp Nước & Thanh Toán (`/checkout/:bookingCode`)

> Đã triển khai route, countdown theo giờ server, chọn combo, xác nhận giá mới,
> lưu combo khi thanh toán, tạo/tiếp tục URL Sandbox và hủy giữ chỗ.
> Thiết kế và nhật ký rà soát: [2026-11-09-checkout-design.md](docs/plans/2026-11-09-checkout-design.md).
> Cần cập nhật schema và khởi động lại backend; hướng dẫn trong
> [CHECKOUT.md](backend/cinema-booking-backend/CHECKOUT.md). Callback VNPay đã có; callback MoMo/vé QR làm sau.

*   **Đồng hồ đếm ngược 10 phút (Countdown Timer):**
    *   Đếm ngược theo `serverTime` và deadline, không phụ thuộc đồng hồ máy khách.
        Khi về 0, kiểm tra lại đơn; chỉ báo hết hạn sau phản hồi server và có nút về trang chủ.
*   **Danh mục Bắp Nước (Combo Concession):**
    *   Thẻ combo (ảnh, tên combo, mô tả, đơn giá, nút tăng/giảm số lượng `+` `-`).
*   **Phương thức thanh toán:**
    *   Lựa chọn Radio Button giữa **VNPay** và **MoMo**.
*   **Nút "Thanh Toán Ngay":**
    *   Gọi API `POST /api/v1/payments/create-url`. Nhận `paymentUrl` và chuyển hướng thẳng trình duyệt sang cổng VNPay/MoMo Sandbox.

### 5. Trang Kết Quả Thanh Toán (`/payment/vnpay-callback` & `/payment/momo-callback`)
> Đã triển khai VNPay (10/11/2026): trang kết quả có xác minh chữ ký tại backend,
> kiểm tra quyền xem đơn, thông tin phim/rạp/ghế/combo/tổng tiền và chờ IPN.
> Chỉ báo đặt vé thành công khi booking CONFIRMED/payment SUCCESS. MoMo, QR và
> hiệu ứng pháo hoa bên dưới chưa triển khai.

*   Frontend bắt các query parameters do cổng thanh toán trả về.
*   Nếu thành công:
    *   Kích hoạt hiệu ứng pháo hoa `canvas-confetti`.
    *   Hiển thị vé xem phim điện tử (E-Ticket) tuyệt đẹp: Mã đơn vé (`bookingCode`), Phim, Rạp, Ghế, Bắp nước, Tổng tiền đã trả.
    *   **Hiển thị mã QR Code:** Hiển thị trực tiếp ảnh QR Code từ chuỗi Base64 (`qrCodeUrl`) mà backend sinh tự động để người dùng quét vào rạp.
*   Nếu thất bại hoặc hết hạn: Hiển thị thông báo hủy và nút quay lại trang chủ.

### 6. Widget Trợ Lý AI Chatbot (CineBot - Nổi ở góc màn hình)

> Đã triển khai: widget trong `MainLayout`, ba câu hỏi gợi ý điền vào ô nhập,
> gửi bằng nút hoặc Enter (Shift+Enter xuống dòng, hỗ trợ IME tiếng Việt),
> hiển thị tin nhắn và trạng thái đang trả lời. Frontend gọi `/chat/ask`, gửi
> lịch sử `user`/`model` của các lượt thành công; câu trả lời hỗ trợ Markdown,
> danh sách và bảng. Giữ hội thoại khi đóng/mở hoặc chuyển trang khách hàng;
> tải lại trang bắt đầu hội thoại mới. Có chặn gửi lặp, khôi phục câu hỏi khi
> request lỗi và hủy request khi widget unmount.
>
> Kiểm chứng: build, ESLint, unit tests và `npm run test:chatbot-browser` sau
> `npm run build` trong thư mục `frontend` (Windows/Edge, API giả lập, không gọi Gemini).
> Backend đã tích hợp Gemini `generateContent`, mặc định `gemini-3.1-flash-lite`;
> API key chỉ ở backend và được gửi qua header. Có timeout và mã HTTP lỗi
> cho frontend xử lý, không trả lời giả bằng HTTP 200 khi Gemini thất bại.
> Đã đạt 30 kiểm tra backend giả lập và 1 kiểm tra hội thoại hai lượt với Gemini
> thật. API `/api/v1/chat/ask` đã trả lời đúng thông tin phim, nhớ lượt trước
> và đưa ra suất chiếu cùng giá cơ bản khớp database (kiểm chứng 11/11/2026).
> Hướng dẫn cấu hình và kiểm thử: [GEMINI.md](backend/cinema-booking-backend/GEMINI.md).
> Nút thử lại riêng vẫn là phần tiếp theo; hiện câu hỏi lỗi được khôi phục để gửi lại.

*   Nút bong bóng nổi cố định ở góc dưới cùng bên phải (`fixed bottom-6 right-6`).
*   Khi bấm mở ra cửa sổ chat hiện đại (giống Messenger / Intercom):
    *   Avatar robot dễ thương, tên "CineBot".
    *   Hỗ trợ người dùng hỏi bằng tiếng Việt: *"Hôm nay có phim gì hài không?", "Giá vé VIP rạp Nguyễn Du bao nhiêu?", "Có suất chiếu nào sau 8 giờ tối không?"*.
    *   Gọi API `POST /api/v1/chat/ask` truyền câu hỏi và lịch sử trò chuyện.
    *   Hiển thị câu trả lời thông minh dạng Markdown có format đẹp mắt.

### 7. Phân Hệ Quản Trị Viên (Admin Portal - `/admin/*`)

**[x] Đã triển khai và nghiệm thu ngày 13/11/2026** theo [kế hoạch Admin](admin-portal-plan.md).
Hướng dẫn chạy/cấp quyền, kiểm thử lặp lại và giới hạn: [ADMIN_PORTAL.md](ADMIN_PORTAL.md).
Có kiểm chứng HTTP/DB/Redis thật trên dữ liệu/tài khoản thử độc lập, tách riêng mô phỏng.

*   Bảo vệ bằng `AdminRoute`: xác minh `/users/me` trước khi tải module/query, yêu cầu ADMIN; backend bảo vệ `/admin/**`, xử lý 401/403 và xóa cache khi đổi phiên.
*   **Báo cáo Thống kê:**
    *   `/admin/reports`: Recharts, KPI/nhóm doanh thu theo ngày tạo đơn CONFIRMED (gồm combo), vé BOOKED, cùng bộ lọc phim/rạp.
    *   Lấp đầy có ngày suất riêng, gồm lịch sử/inactive, nguồn sức chứa và cảnh báo thiếu cấu hình; URL lưu bộ lọc/ngày/nhóm.
*   **Quản lý Phim & Suất chiếu:**
    *   `/admin/movies`: tìm tên/lọc ba trạng thái/phân trang server, modal thêm/sửa đủ DTO; URL giữ bộ lọc.
    *   `/admin/showtimes`: danh sách suất đang mở bán và form thêm theo phòng thuộc rạp, giờ Việt Nam; 409 giữ form. Sửa/xóa và lịch sử suất dành cho đợt sau.
*   **Đồng bộ Dữ liệu 1-Click:**
    *   `/admin/sync`: nhập file offline đóng gói qua `POST /api/v1/admin/sync/galaxy/local-file`, giới hạn mặc định 100/0 = mọi suất tương lai; kết quả nguồn/thời gian/chín bộ đếm, không sinh ghế.
    *   Trạng thái online riêng, không gán `syncedAt` offline vào `lastSuccessAt`; khóa gửi, 409/timeout không tự POST lại, làm mới cache catalog/báo cáo.

---

## VI. LỘ TRÌNH TRIỂN KHAI 5 BƯỚC CHO AGENT FRONTEND

1.  **Bước 1: Khởi tạo Project & Cấu hình Hạ tầng**
    *   Khởi tạo Vite React, cài đặt Tailwind CSS, cấu hình bảng màu Cinematic Dark Mode trong `tailwind.config.js`.
    *   Cài đặt `axios`, `react-router-dom`, `zustand`, `lucide-react`, `clsx`, `tailwind-merge`, `@stomp/stompjs`, `sockjs-client`.
    *   Thiết lập `axiosInstance` tự động đính Bearer token và unwrap `response.data.data`.
2.  **Bước 2: Xây dựng Layout & Xác thực (Auth)**
    *   Tạo `MainLayout` (Header, Footer) và `authStore` (Zustand).
    *   Tạo Modal Đăng nhập / Đăng ký, lưu Access Token vào `localStorage` và State.
3.  **Bước 3: Trang Chủ & Trang Chi Tiết Phim**
    *   Kết nối API lấy danh sách phim Đang chiếu & Sắp chiếu.
    *   Dựng Banner Carousel, Movie Cards, Modal xem Trailer.
    *   Xây dựng bộ chọn suất chiếu theo ngày và rạp trên trang Chi tiết phim.
4.  **Bước 4: Trọng tâm - Sơ đồ Ghế Real-time, Countdown & Thanh toán**
    *   Dựng sơ đồ ma trận ghế uốn cong.
    *   Tích hợp WebSocket STOMP lắng nghe đổi màu ghế real-time.
    *   Tích hợp API giữ ghế 10 phút (`/bookings`), Timer đếm ngược và chuyển hướng sang VNPay/MoMo.
    *   Dựng trang Callback hiển thị vé điện tử và mã QR Code.
5.  **Bước 5: Hoàn thiện CineBot AI Widget & Admin Portal**
    *   Tích hợp Widget chat với Google Gemini API.
    *   Dựng các màn hình Admin (Thống kê doanh thu, quản lý phim, nút đồng bộ Galaxy).
    *   Kiểm tra toàn bộ luồng responsive từ Desktop đến Mobile.
