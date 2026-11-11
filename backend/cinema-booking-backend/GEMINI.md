# Chạy CineBot với Gemini thật

Frontend gửi `POST /api/v1/chat/ask`; backend lấy phim, lịch chiếu và combo
từ database, thêm ngữ cảnh rồi gọi Google `generateContent`.
API key chỉ nằm ở backend.

## Cấu hình và chạy bằng F5

1. Lấy API key của dự án trong [Google AI Studio](https://aistudio.google.com/api-keys).
2. Mở `src/main/resources/application.yml`, tìm block `application.gemini` đã có.
   Điền khóa thật vào trường `api-key` tại máy, không thêm block `application`
   thứ hai. File này được Git bỏ qua. Ví dụ cấu trúc:

   ```yaml
   application:
     gemini:
       api-key: '<khóa Gemini lưu tại máy>'
       model: ${GEMINI_MODEL:gemini-3.1-flash-lite}
       api-url: https://generativelanguage.googleapis.com/v1beta/models
       connect-timeout-ms: 5000
       read-timeout-ms: 45000
   ```

   Nếu dùng biến môi trường, đặt `api-key: ${GEMINI_API_KEY:}` và cấp biến
   `GEMINI_API_KEY` cho tiến trình Java. Spring Boot không tự đọc file `.env`.
3. **Dừng backend đang chạy rồi chạy lại bằng F5** để nạp khóa, model và mã mới.
4. Bật frontend, mở CineBot và hỏi: “Hôm nay có phim nào đang chiếu?”.
   Hỏi tiếp “Có suất nào sau 20 giờ không?” để kiểm tra lịch sử hội thoại.

Model mặc định là [Gemini 3.1 Flash-Lite](https://aistudio.google.com/docs/models/gemini-3.1-flash-lite).
Model cũ `gemini-2.0-flash` đã ngừng hoạt động theo
[lịch ngừng hỗ trợ của Google](https://aistudio.google.com/docs/deprecations).
Quyền truy cập và quota còn phụ thuộc dự án chứa API key; có tên model trong
danh sách không bảo đảm mọi lần sinh câu trả lời đều thành công.

## Kiểm tra riêng kết nối Google

Chạy tại `backend/cinema-booking-backend`, dùng Java 21.
Các lệnh dùng cấu hình trong `application.yml` và biến môi trường hiện tại;
không truyền khóa trong câu lệnh và không in khóa ra console.

Kiểm tra tự động bằng máy chủ giả lập tại máy, không gọi Google/database:

```powershell
.\mvnw.cmd "-Dtest=GeminiClientTests" test
```

Tra các model mà khóa truy cập được:

```powershell
.\mvnw.cmd "-Dtest=GeminiLiveApiTests#listsAvailableTextModels" "-Dgemini.live=true" test
```

Kiểm tra hai lượt hội thoại thật qua `GeminiClientService`:

```powershell
.\mvnw.cmd "-Dtest=GeminiLiveApiTests#answersInVietnameseAndRemembersPreviousTurn" "-Dgemini.live=true" test
```

Lệnh cuối gọi Google hai lần, sử dụng quota của dự án. Nó kiểm tra phản hồi
và việc nhớ thông tin lượt trước, không khởi động Spring hay truy cập database.
Các test thật chỉ chạy khi bật `gemini.live=true`.

## Kết quả kiểm chứng ngày 11/11/2026

- `GeminiClientTests`: 30 kiểm tra đạt, gồm định dạng request, bảo vệ khóa,
  timeout, phản hồi trống/sai, lỗi Google và mã HTTP của `/chat/ask`.
- `GeminiLiveApiTests#answersInVietnameseAndRemembersPreviousTurn`: đạt với
  `gemini-3.1-flash-lite`; nhận hai câu trả lời thật, nhớ đúng mã ở lượt trước.
- Backend đang chạy trả HTTP 200 khi hỏi phim **Trại Buôn Người**; câu trả lời
  nêu thể loại **Hành động, Tâm lý**, thời lượng **135 phút**, khớp database.
- Lượt tiếp theo chỉ hỏi “Phim tôi vừa hỏi...” kèm lịch sử; backend trả HTTP 200,
  nêu **Galaxy Cinema Mipec Long Biên**, **10:45 ngày 11/11/2026**, giá cơ bản
  **80.000 VND**. Đã đối chiếu với API lịch chiếu, khớp suất ID **8850**.

Trong quá trình kiểm thử có gặp lỗi Google 503 và giới hạn 429. Cấu hình đã
nhận được câu trả lời thật nhưng vẫn phụ thuộc khả dụng/quota của nhà cung cấp.
Lượt bị 429 đã thành công khi gửi lại sau khoảng nghỉ. Nếu gặp 429, chờ rồi
gửi lại; không chạy liên tục các kiểm tra thật.

## Kiểm tra API của ứng dụng đang chạy

Sau khi khởi động lại backend và database sẵn sàng:

```powershell
$chatBody = @{
  message = 'Hôm nay có phim nào đang chiếu?'
  conversationHistory = @()
} | ConvertTo-Json -Depth 8
Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/v1/chat/ask' `
  -ContentType 'application/json; charset=utf-8' `
  -Body ([Text.Encoding]::UTF8.GetBytes($chatBody))
```

Thành công trả `data.reply` và `data.timestamp`. Câu hỏi hiện tại chỉ nằm
trong `message`; `conversationHistory` chứa các lượt trước với `role` là
`user`/`model` và `text`. Dữ liệu lịch chiếu hiện đưa vào Gemini chỉ gồm
giá cơ bản; xem giá từng loại ghế ở trang chọn ghế.

## Khi gọi thất bại

| HTTP từ backend | Ý nghĩa và cách kiểm tra |
| --- | --- |
| 503 | Thiếu khóa, khóa mẫu, cấu hình/model bị Google từ chối, hoặc lỗi kết nối. Xem mã HTTP Google trong log; đối chiếu key, quyền dự án và model. |
| 429 | Google giới hạn tốc độ/quota. Kiểm tra [usage trong AI Studio](https://aistudio.google.com/usage), đợi rồi thử lại. |
| 504 | Quá thời gian chờ phản hồi Google. |
| 502 | Google lỗi máy chủ, JSON không hợp lệ hoặc không có nội dung trả lời. |
| 422 | Google không trả lời nội dung này; diễn đạt lại câu hỏi. |

Backend gửi khóa qua header `x-goog-api-key`, không đưa khóa vào URL.
Log chỉ ghi loại lỗi/mã HTTP, không ghi khóa, toàn bộ câu hỏi hoặc body lỗi
của Google. Không tự retry request sinh nội dung. Lỗi không còn được đổi
thành `reply` với HTTP 200; frontend hiện khôi phục câu hỏi để gửi lại.

Hợp đồng Google: [generateContent](https://aistudio.google.com/api-reference/generate-content/generate-content).
