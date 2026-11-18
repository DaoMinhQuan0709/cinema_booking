/**
 * Cách ly dữ liệu vé theo phiên (Mục 3):
 * - queryKey bắt đầu bằng ['my-tickets', sessionId] → dữ liệu của từng phiên tách biệt hoàn toàn.
 * - gcTime: 0 → cache bị GC ngay sau khi observer cuối cùng unsubscribe (component unmount).
 * - AbortSignal → request đang bay bị hủy khi query bị cancel (logout/đổi tài khoản).
 * - clearTicketCache() trong authStore → cancel + remove query ngay khi đổi/xóa phiên,
 *   không chờ GC tự nhiên, không để dữ liệu cũ làm placeholder cho phiên mới.
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
    enabled, gcTime: 0, retry: false,
  });
}

export function useTicketDetail(code) {
  const { sessionId, enabled } = useTicketSession();
  return useQuery({
    queryKey: ['my-tickets', sessionId, 'detail', code],
    queryFn: ({ signal }) => ticketService.getDetail(code, signal),
    enabled: enabled && isBookingCode(code), gcTime: 0, retry: false,
  });
}
