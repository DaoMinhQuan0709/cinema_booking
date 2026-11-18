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
