import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '../../auth/authStore';
import { bookingService } from '../../../services/bookingService';
import { checkoutKey, remainingSeconds } from '../checkoutUtils';
import { seatMapKeys } from './useShowtimeSeats';
import { invalidateTicketCache } from '../../../config/queryClient';

export function useCheckoutBooking(userId, code, sessionId) {
  return useQuery({ queryKey: checkoutKey(userId, code, sessionId), queryFn: ({ signal }) => bookingService.getCheckout(code, signal),
    retry: (count, error) => count < 1 && (!error.response || error.response.status >= 500), staleTime: 0, gcTime: 0,
    refetchOnWindowFocus: 'always', refetchInterval: query => ['CREATING', 'UNKNOWN'].includes(query.state.data?.checkout?.state) ? 5000 : 15000,
  });
}

export function useBookingSession(userId, sessionId) {
  const activeRef = useRef(false);
  useEffect(() => { activeRef.current = true; return () => { activeRef.current = false; }; }, []);
  return () => activeRef.current && useAuthStore.getState().sessionId === sessionId && useAuthStore.getState().user?.id === userId;
}

export function useApplySavedProducts(userId, code, sessionId, isCurrentUser) {
  const client = useQueryClient();
  const queryKey = checkoutKey(userId, code, sessionId);

  return async (saved, updateForm) => {
    if (!isCurrentUser()) return false;
    await client.cancelQueries({ queryKey });
    if (!isCurrentUser()) return false;
    client.setQueryData(queryKey, saved);
    updateForm();
    void invalidateTicketCache(sessionId);
    return true;
  };
}

export function useBookingCountdown(booking, query) {
  const [now, setNow] = useState(() => performance.now());
  const expiredChecked = useRef(false);
  const { isFetching, refetch } = query;
  const seconds = remainingSeconds(booking._timing, now);
  useEffect(() => { const timer = setInterval(() => setNow(performance.now()), 250); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (seconds > 0) expiredChecked.current = false;
    if (seconds === 0 && booking.status === 'PENDING' && !expiredChecked.current && !isFetching) {
      expiredChecked.current = true;
      void refetch();
    }
  }, [seconds, booking.status, isFetching, refetch]);

  return seconds;
}

export function useBookingCancellation({ booking, code, userId, sessionId, busy: busyRef, setOperation, setDialog, synchronize }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const key = checkoutKey(userId, code, sessionId);
  const isCurrentUser = useBookingSession(userId, sessionId);
  async function cancel() {
    const sessionId = useAuthStore.getState().sessionId;
    if (busyRef.current) return;
    busyRef.current = true; setOperation('cancel');
    try {
      await bookingService.cancelBooking(code);
      if (!isCurrentUser()) return;
      const storageKey = `cinema:hold:${userId}:${booking.showtime.showtimeId}`;
      try { if (sessionStorage.getItem(storageKey) === code) sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
      await client.invalidateQueries({ queryKey: seatMapKeys.seats(booking.showtime.showtimeId) });
      if (!isCurrentUser()) return;
      client.removeQueries({ queryKey: key, exact: true });
      if (isCurrentUser()) void invalidateTicketCache(sessionId);
      toast.success('Đã hủy giữ ghế.', { id: 'checkout-cancelled' });
      navigate(`/booking/${booking.showtime.showtimeId}`, { replace: true });
    } catch (error) {
      if (isCurrentUser()) { toast.error(error.response?.data?.message ?? 'Chưa hủy được giữ ghế.', { id: 'checkout-error' }); await synchronize(); }
    } finally { busyRef.current = false; setOperation(null); setDialog(null); }
  }

  return cancel;
}
