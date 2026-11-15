# Triển khai xóa phim/suất, ngăn Galaxy nhập lại

Ngày: 15/11/2026. Người dùng đã duyệt thiết kế và yêu cầu lập kế hoạch, triển khai.
Thiết kế: [bản đã duyệt](docs/plans/2026-11-15-admin-deletion-design.md).
Git đầu đợt: HEAD `db43fd7`; giữ hai tài liệu thiết kế/tiến độ đang thay đổi.

- [x] 1. Thêm dấu xóa, tham chiếu giao dịch attempt, chỉ mục và SQL nâng schema → kiểm tra mapping/SQL trên DB thử, prod validate.
- [x] 2. Tạo guard/khóa theo thứ tự phim → suất → đơn → ghế và phối hợp sync → kiểm chứng khóa/timeout bằng PostgreSQL thật.
- [x] 3. Viết preview nhất quán và DELETE nguyên tử/idempotent, kiểm tra đơn/tiền, actor và If-Match → test blocker/412/428/rollback/phân quyền.
- [x] 4. Lọc danh mục/chi tiết/chatbot/inventory và giữ lịch sử/báo cáo → test API đọc, không sinh ghế khi xóa/preview.
- [x] 5. Bỏ qua dấu xóa trong mọi nhánh importer/claim/writer, thêm số đếm loại trừ → test full/limited/file/JSON, nhận local và restart context.
- [x] 6. Bảo vệ đặt vé/tạo suất và callback muộn, lưu giao dịch đúng attempt/duy nhất → test tranh chấp, FAILED muộn, trùng/mâu thuẫn, không phát vé/hoàn tiền tự động.
- [x] 7. Thêm service/hooks/modal/nút xóa và số đếm sync; giữ phiên/cache/URL → lint/unit/build và Edge mô phỏng desktop/390px, lỗi/mất phản hồi.
- [x] 8. Cập nhật tài liệu vận hành/schema/rollout và tiến độ → đối chiếu hướng dẫn, không sửa DB hoặc khởi động lại backend vận hành.
- [x] 9. Nghiệm thu cuối: Maven toàn bộ, Edge mô phỏng và HTTP/PostgreSQL/Redis thử thật → ghi riêng số đạt/bỏ qua/giới hạn/artifact; diff sạch lỗi định dạng, không commit/push.

Phụ thuộc: 1 → 2 → 3/4/5/6 → 7 → 8 → 9. Chỉ tick sau kiểm chứng.
Không thêm khôi phục, hàng loạt, hủy vé/hoàn tiền hoặc worker gateway mới.

## Kết quả và ghi chú tiếp tục

- Frontend lint, unit **92/92**, production build đạt.
- Maven toàn bộ **208 test: 205 đạt/3 live skip**, không lỗi; gồm **18/18**
  AdminDeletionHttpTests, **8/8** AdminPortalHttpTests, **15/15** checkout DB,
  **9/9** báo cáo DB và kiểm tra Redis thật. Galaxy/Gemini live không chạy.
- **Mô phỏng riêng:** 8 bộ Edge đạt **127 nhóm**, 0 lỗi runtime: Admin 35,
  phim 13, suất 17, xóa 8, báo cáo 15, sync 15, checkout 18, CineBot 6.
  Bộ xóa có 53 request; artifact `cinema-admin-deletion-y4n79x` trong temp.
- **Tích hợp thật:** Edge xóa 4 hành trình/31 request (gồm preflight), Edge
  hồi quy Admin 8 hành trình/44 response, không mock REST và 0 lỗi runtime.
  Artifact chung `cinema-admin-acceptance-a3f542d0ba0b4872aadf46df9deeba75`
  trong temp: `edge-deletion-http`, `edge-http`, `maven.log` và query plan.
- SQL chạy lại hai lần, context JPA mới dùng schema validate và vẫn chặn sync;
  EXPLAIN dùng Index Only Scan trên 20.000 đơn thử. Cluster/Redis thử đã dừng.
  Không xác nhận giao dịch tiền thật hoặc Galaxy/Gemini ngoài hệ thống; không
  sửa DB vận hành, chưa áp dụng schema/restart backend đang dùng, không commit.

Các lỗi fixture đã xử lý: callback trùng dùng cùng transactionId; cấu hình
restart tách khỏi Boot mặc định; URL lọc phim dùng q; mock hỗ trợ CORS/If-Match;
hồi quy suất cho phép nút xóa mới. Kết quả cuối bên trên đều đạt sau sửa.
