import { getVietnamClock } from '../showtimes/scheduleUtils.js';
import { isInternalShowtimeId } from '../../utils/showtimeId.js';
import { isCalendarDate } from './movieForm.js';

const FILTER_NAMES = ['startDate', 'endDate', 'cinemaId', 'movieId', 'groupBy', 'occupancyDate'];
const countFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const moneyFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const compactFormatter = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 });

export const CAPACITY_SOURCES = {
  INVENTORY: 'Ghế theo suất', ACTIVE_SEATS: 'Ghế đang hoạt động',
  ROOM_LAYOUT: 'Sơ đồ hàng × cột', UNCONFIGURED: 'Thiếu cấu hình',
};

export function defaultReportFilters(now = new Date()) {
  const today = getVietnamClock(now).date;
  return { startDate: `${today.slice(0, 7)}-01`, endDate: today, cinemaId: '', movieId: '', groupBy: 'movie', occupancyDate: today };
}

export function readReportFilters(params, now = new Date()) {
  const defaults = defaultReportFilters(now);
  return Object.fromEntries(FILTER_NAMES.map(name => {
    const value = params.get(name) || '';
    if (name.endsWith('Date')) return [name, isCalendarDate(value) ? value : defaults[name]];
    if (name === 'groupBy') return [name, ['movie', 'cinema'].includes(value) ? value : defaults.groupBy];
    return [name, isInternalShowtimeId(value) ? value : ''];
  }));
}

export function writeReportFilters(params, filters) {
  const next = new URLSearchParams(params);
  for (const name of FILTER_NAMES) {
    if (filters[name]) next.set(name, filters[name]);
    else next.delete(name);
  }
  return next;
}

export function validateRevenueRange({ startDate, endDate }) {
  const errors = {};
  if (!isCalendarDate(startDate || '')) errors.startDate = 'Vui lòng chọn ngày bắt đầu hợp lệ.';
  if (!isCalendarDate(endDate || '')) errors.endDate = 'Vui lòng chọn ngày kết thúc hợp lệ.';
  else if (!errors.startDate && startDate > endDate) errors.endDate = 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.';
  return errors;
}

export function reportNumber(value) {
  if (value == null || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) return null;
  return Number(value);
}

export const formatReportCount = value => reportNumber(value) == null ? '—' : countFormatter.format(Number(value));
export const formatReportMoney = value => reportNumber(value) == null ? '—' : `${moneyFormatter.format(Number(value))}đ`;
export const formatReportPercent = value => reportNumber(value) == null ? '—' : `${percentFormatter.format(Number(value))}%`;
export const formatCompactMoney = value => reportNumber(value) == null ? '—' : compactFormatter.format(Number(value));

// Chỉ giới hạn biểu đồ; bảng vẫn giữ đủ nhóm và không thay đổi dữ liệu cache.
export function selectRevenueChartRows(rows, limit = 10) {
  return rows.filter(row => reportNumber(row.revenue) != null).map(row => ({ ...row, value: Number(row.revenue) }))
    .sort((a, b) => b.value - a.value || String(a.id).localeCompare(String(b.id), 'vi', { numeric: true }))
    .slice(0, limit).map(row => {
      const label = String(row.label || 'Chưa có tên');
      const identity = row.id == null ? '' : ` · #${row.id}`;
      return { ...row, fullLabel: label + identity, axisLabel: (label.length > 22 ? `${label.slice(0, 21)}…` : label) + identity };
    });
}
