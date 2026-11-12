export const DEFAULT_SYNC_LIMIT = '100';
export const SYNC_COUNTERS = [
  { key: 'totalMoviesSynced', label: 'Phim đã xử lý' },
  { key: 'totalCinemasSynced', label: 'Rạp đã xử lý' },
  { key: 'totalAuditoriumsSynced', label: 'Phòng đã xử lý' },
  { key: 'totalShowtimesSynced', label: 'Suất đã cập nhật' },
  { key: 'totalShowtimesSkipped', label: 'Suất bị bỏ qua' },
  { key: 'totalShowtimesDeactivated', label: 'Suất ngừng mở bán' },
  { key: 'totalMoviesEnded', label: 'Phim chuyển ngừng chiếu' },
  { key: 'totalSeatsSynced', label: 'Ghế vật lý đã tạo' },
  { key: 'totalShowtimeSeatsSynced', label: 'Ghế theo suất đã tạo' },
];
const numberFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function prepareSyncLimit(value) {
  const clean = String(value ?? '').trim();
  if (!/^\d+$/.test(clean) || Number(clean) > 2_147_483_647) {
    return { error: 'Nhập số nguyên từ 0 đến 2.147.483.647; 0 là tất cả suất tương lai.' };
  }
  return { payload: { limitShowtimes: Number(clean) } };
}

export function formatSyncCount(value) {
  if (value == null || String(value).trim() === '' || !Number.isSafeInteger(Number(value)) || Number(value) < 0) return '—';
  return numberFormatter.format(Number(value));
}

export function formatSyncLimit(value) {
  return Number(value) === 0 && value != null && String(value).trim() !== '' ? 'Tất cả suất tương lai' : `${formatSyncCount(value)} suất`;
}

// Instant từ backend luôn có múi giờ; không tự đoán mốc local hoặc thay bằng giờ hiện tại.
export function formatSyncTime(value) {
  if (value == null || value === '') return 'Chưa có mốc được ghi nhận';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return 'Không xác định';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? timeFormatter.format(date) : 'Không xác định';
}

export function syncStatusPollInterval(query, importing = false) {
  if (importing) return 2_000;
  return query.state.status === 'success' && query.state.data?.running === true ? 2_000 : false;
}
