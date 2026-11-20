import axiosInstance from '../../config/axiosInstance';
import { bookingService } from '../../services/bookingService';
import { requireTicketPng } from './ticketQr';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export const ticketService = {
  async getHistory(signal) {
    const { data } = await axiosInstance.get('/users/me/bookings', { signal, skipErrorToast: true });
    if (!Array.isArray(data) || !data.every(isRecord)) throw new Error('Dữ liệu danh sách vé không hợp lệ.');
    return data;
  },
  async getDetail(code, signal) {
    const data = await bookingService.getBooking(code, { signal });
    if (!isRecord(data) || data.bookingCode !== code) throw new Error('Dữ liệu chi tiết vé không hợp lệ.');
    return data;
  },
  async getQr(code, signal) {
    const response = await axiosInstance.get(`/bookings/${encodeURIComponent(code)}/qr`, {
      signal,
      responseType: 'blob',
      skipErrorToast: true,
    });
    return requireTicketPng(response?.data);
  },
};
