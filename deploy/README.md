# Triển khai Cinema Booking Demo

VPS Linux x86-64 chạy Caddy, một Spring Boot backend, PostgreSQL 18 và Redis 7 bằng Docker Compose. Caddy phục vụ SPA và chuyển API, ảnh sản phẩm và WebSocket trên cùng tên miền HTTPS. PostgreSQL giữ dữ liệu giao dịch, Redis giữ khóa ghế, Flyway áp dụng migration trước khi backend kiểm tra schema. Bản demo dùng dữ liệu riêng và VNPay Sandbox.

## Chuẩn bị VPS và phát hành

1. Cấp quyền SSH cho tài khoản deploy và cài Git, curl cùng Docker Engine với Compose v2.24 trở lên. Khởi điểm dùng 2 vCPU và 4 GB RAM. Trỏ bản ghi A của tên miền về VPS, cho phép TCP 80/443 và giới hạn SSH trong firewall. Caddy sẽ cấp chứng chỉ khi DNS và các cổng web truy cập được từ Internet. [Docker Engine](https://docs.docker.com/engine/install/) · [Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https)
2. Lấy `release.env` từ artifact `cinema-release-<commit>` của workflow **Verify and publish demo images** trên GitHub Actions. Checkout đúng `RELEASE_COMMIT` trên VPS. Manifest chứa digest của hai image đã qua test. Nếu GHCR yêu cầu xác thực, cấp token có quyền đọc package qua stdin cho `docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin`. [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
3. Tạo file môi trường và cấp giá trị tại VPS. Dùng `CINEMA_ORIGIN=https://<domain>` với tên miền thật. Sinh riêng `POSTGRES_PASSWORD`, `DB_PASSWORD`, `REDIS_PASSWORD` và `JWT_SECRET` bằng `openssl rand -hex 32`. Điền `VNPAY_TMN_CODE` và `VNPAY_HASH_SECRET` từ merchant Sandbox. PostgreSQL dùng hai tài khoản riêng cho bootstrap và ứng dụng. Giữ nguyên mật khẩu DB sau khi volume được khởi tạo cho tới khi đổi mật khẩu trong PostgreSQL.

   ```bash
   install -m 600 deploy/.env.example deploy/.env
   ```

4. Đăng ký `https://<domain>/api/v1/payments/vnpay-ipn` trong cấu hình merchant Sandbox. Backend lấy `https://<domain>/payment/vnpay-callback` từ `CINEMA_ORIGIN` làm Return URL. Khi merchant cần VNPay hỗ trợ đăng ký IPN, cung cấp TmnCode và URL IPN qua kênh hỗ trợ. [Tài liệu VNPay](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html)
5. Mount thư mục sao lưu ngoài VPS với quyền ghi cho tài khoản deploy, rồi chạy từ thư mục gốc của repo trên VPS.

   ```bash
   mountpoint -q /mnt/cinema-backups && \
     bash deploy/ops.sh release /opt/cinema-releases/release.env /mnt/cinema-backups
   ```

   Script kéo image, dừng backend trong lúc sao lưu và migrate, nạp catalog và combo ở lần phát hành đầu, rồi khởi động web. Sau khi health và các đường dẫn công khai đạt, `deploy/.env.release` ghi commit, digest và phiên bản schema. Bản trước được giữ ở `deploy/.env.previous`. Nếu lệnh dừng ở giữa, dùng trạng thái container và log để xác định bước lỗi. Phiên bản trong `.env.release` vẫn là bản gần nhất đã qua kiểm tra.

Lần đầu dùng PostgreSQL mới. Khi thay đổi schema sau phát hành, thêm file migration có số phiên bản tiếp theo vào `deploy/migrations/`. Flyway dùng checksum để xác thực các file đã áp dụng.

## Nghiệm thu bản công khai

Dùng hàm Compose sau từ thư mục gốc của repo. Trong khi phát hành chưa hoàn tất, đổi đường dẫn `.env.release` trong lệnh sang manifest ứng viên.

```bash
dc() {
  docker compose -f deploy/compose.yaml --project-name cinema-demo \
    --env-file deploy/.env --env-file deploy/.env.release "$@"
}
dc ps
dc exec -T backend curl -fsS http://127.0.0.1:8081/actuator/health
```

- Đăng ký hai tài khoản khách thử và một tài khoản riêng làm admin. Cấp quyền cho đúng email đã đăng ký rồi đăng nhập lại bằng tài khoản đó.

  ```bash
  dc exec -T postgres psql -X -U cinema -d cinema -v ON_ERROR_STOP=1 \
    --set=admin_email='admin@example.com' <<'SQL'
  UPDATE users SET role = 'ADMIN'
  WHERE email = :'admin_email' AND role = 'CUSTOMER'
  RETURNING id, email, role;
  SQL
  ```

- Tải lại `/admin`, `/profile/bookings` và `/payment/vnpay-callback` trên trình duyệt. Xác nhận ảnh combo hiển thị, admin vào được trang quản lý và tài khoản khách bị từ chối API admin. Nếu các suất mẫu đã qua ngày, `bash deploy/ops.sh seed` bổ sung các suất tương lai theo giờ Việt Nam.
- Mở cùng sơ đồ ghế bằng hai phiên. Giữ một ghế và xác nhận chỉ một phiên thành công. Phiên còn lại nhận cập nhật qua WSS. Để một lần giữ hết 10 phút và kiểm tra ghế trở lại trạng thái có thể đặt sau lần cleanup tiếp theo.
- Gọi IPN công khai không kèm tham số và kiểm tra HTTP 200 với `RspCode` là `97`. Tiếp theo thanh toán thật **trong Sandbox** trên một đơn riêng, rồi thử hủy một giao dịch khác. Đối chiếu IPN, payment `SUCCESS`, booking `CONFIRMED`, ghế `BOOKED` và QR trong **Vé của tôi**. Nếu thanh toán đã hoàn tất phía VNPay nhưng đơn còn `PENDING`, kiểm tra cấu hình IPN và đối soát giao dịch đó. [Hướng dẫn checkout](../backend/cinema-booking-backend/CHECKOUT.md)
- Theo dõi health và log 30 phút đầu bằng `dc logs --follow --since 5m frontend backend`. Tìm lỗi 5xx, ngắt kết nối và request tới đường dẫn IPN. Caddy ghi đường dẫn và HTTP status, bỏ query string khỏi access log.

## Sao lưu và khôi phục

Đặt lịch backup hằng ngày trên VPS. Ví dụ crontab của tài khoản deploy, với repo tại `/opt/cinema_booking` và điểm mount ngoài VPS tại `/mnt/cinema-backups`.

```cron
15 2 * * * cd /opt/cinema_booking && mountpoint -q /mnt/cinema-backups && bash deploy/ops.sh backup /mnt/cinema-backups
```

**Quay về bản ứng dụng trước.** Khi schema hiện tại tương thích với cặp image cũ, chạy `bash deploy/ops.sh rollback`. Nếu bản ứng viên lỗi trước khi ghi `.env.release`, chạy `bash deploy/ops.sh rollback deploy/.env.release`. Cả hai lệnh kiểm tra health, catalog và IPN công khai trước khi ghi lại trạng thái phát hành.

**Thử phục hồi DB.** Tạo database riêng trong PostgreSQL, phục hồi file dump, rồi kiểm tra phiên bản Flyway và dữ liệu đặt vé. Lệnh dưới đây giữ database phục hồi để đối chiếu.

```bash
dump=/mnt/cinema-backups/<backup-file>.dump
restore_db="cinema_restore_$(date -u +%Y%m%d%H%M%S)"
dc exec -T postgres createdb -U postgres -O cinema "$restore_db"
dc exec -T postgres pg_restore -U cinema -d "$restore_db" \
  --exit-on-error --no-owner --no-privileges < "$dump"
dc exec -T postgres psql -X -U cinema -d "$restore_db" -v ON_ERROR_STOP=1 \
  -c 'SELECT version, success FROM flyway_schema_history ORDER BY installed_rank;' \
  -c 'SELECT status, count(*) FROM bookings GROUP BY status;'
```

**Phục hồi thật.** Dừng backend để chặn đơn mới, lưu thêm dump của trạng thái hiện tại và phục hồi vào một database riêng như trên. Đối soát giao dịch Sandbox sau mốc backup, giữ lại database cũ và đổi tên database đã đối soát thành `cinema` trong cửa sổ bảo trì. Đợi các khóa Redis của phiên trước hết TTL, chọn image tương thích với schema phục hồi và kiểm tra lại health, giữ ghế và VNPay trước khi mở truy cập.
