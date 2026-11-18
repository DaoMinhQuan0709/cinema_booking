/**
 * Quản lý truy vấn dữ liệu vé:
 * - Cách ly dữ liệu theo phiên (Mục 3): queryKey theo sessionId, gcTime: 0, AbortSignal, clearTicketCache.
 * - Cập nhật trạng thái và chu kỳ làm mới (Mục 4):
 *   + staleTime: 30 giây, tự làm mới khi focus tab (refetchOnWindowFocus: true).
 *   + Polling: danh sách có đơn PENDING hoặc chi tiết đơn PENDING tự động làm mới mỗi 30 giây khi tab đang mở.
 *   + Dừng polling khi không còn đơn PENDING hoặc khi tab ẩn/chuyển nền (refetchIntervalInBackground: false).
 */
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../auth/authStore';
import { ticketService } from './ticketService';
import { isBookingCode } from './ticketUtils';

function useTicketSession() {
  const sessionId = useAuthStore(state => state.sessionId);
  const verified = useAuthStore(state => state.sessionStatus === 'authenticated');
  return { sessionId, enabled: verified && Boolean(sessionId) };
}

export function useTicketHistory() {
  const { sessionId, enabled } = useTicketSession();
  return useQuery({
    queryKey: ['my-tickets', sessionId, 'list'],
    queryFn: ({ signal }) => ticketService.getHistory(signal),
    enabled,
    gcTime: 0,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: query => Array.isArray(query.state.data) && query.state.data.some(t => t.status === 'PENDING') ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useTicketDetail(code) {
  const { sessionId, enabled } = useTicketSession();
  return useQuery({
    queryKey: ['my-tickets', sessionId, 'detail', code],
    queryFn: ({ signal }) => ticketService.getDetail(code, signal),
    enabled: enabled && isBookingCode(code),
    gcTime: 0,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: query => query.state.data?.status === 'PENDING' ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useTicketQr(code, isConfirmed) {
  const { sessionId, enabled } = useTicketSession();
  return useQuery({
    queryKey: ['my-tickets', sessionId, 'qr', code],
    queryFn: ({ signal }) => ticketService.getQr(code, signal),
    enabled: enabled && isBookingCode(code) && Boolean(isConfirmed),
    gcTime: 0,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}
