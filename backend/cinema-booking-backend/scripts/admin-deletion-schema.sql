-- Chạy trước khi mở chức năng xóa; dừng toàn bộ backend/worker cũ theo hướng dẫn.
-- Chỉ bổ sung schema, không xóa bản ghi hoặc tự suy đoán giao dịch lịch sử.
BEGIN;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS deleted_by_user_id bigint;
ALTER TABLE showtimes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE showtimes ADD COLUMN IF NOT EXISTS deleted_by_user_id bigint;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS provider_transaction_id varchar(100);
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS received_at timestamp;
CREATE INDEX IF NOT EXISTS idx_bookings_showtime_status ON bookings(showtime_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uk_attempt_provider_transaction ON payment_attempts(method, provider_transaction_id);
COMMIT;
