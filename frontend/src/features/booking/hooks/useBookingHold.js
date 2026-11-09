import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { bookingService } from '../../../services/bookingService';
import { useAuthStore } from '../../auth/authStore';
import { applySeatStatusUpdate } from '../../../utils/seatRealtime';
import { buildHoldRequest, getHoldErrorMessage, getHoldExpiry } from '../bookingHold';
import { seatMapKeys } from './useShowtimeSeats';

function savedCode(userId, showtimeId, value) {
  if (userId == null) return null;
  const key = `cinema:hold:${userId}:${showtimeId}`;
  try {
    if (value === undefined) return sessionStorage.getItem(key);
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch { /* Holding still works when browser storage is unavailable. */ }
  return null;
}

function initialRestoration(userId, showtimeId) {
  return { userId, pending: Boolean(savedCode(userId, showtimeId)), error: false };
}

export function useBookingHold(showtimeId) {
  const queryClient = useQueryClient();
  const userId = useAuthStore(state => state.isAuthenticated ? state.user?.id : null);
  const [receipt, setReceipt] = useState(null);
  const [operation, setOperation] = useState(null);
  const [restoration, setRestoration] = useState(() => initialRestoration(userId, showtimeId));
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const busy = useRef(false);
  const submitting = useRef(null);
  const owned = useRef(null);
  const createMutation = useMutation({ mutationFn: bookingService.createBooking, retry: false });
  const cancelMutation = useMutation({ mutationFn: bookingService.cancelBooking, retry: false });
  const booking = receipt?.userId === userId ? receipt?.booking : null;
  const queryKey = seatMapKeys.seats(showtimeId);

  if (restoration.userId !== userId) setRestoration(initialRestoration(userId, showtimeId));

  useEffect(() => {
    const code = savedCode(userId, showtimeId);
    if (!code) return undefined;
    const controller = new AbortController();
    bookingService.getBooking(code, { signal: controller.signal }).then(response => {
      if (controller.signal.aborted) return;
      if (response.status === 'PENDING' && String(response.showtime?.showtimeId) === String(showtimeId)
        && getHoldExpiry(response.expiresAt) > Date.now()) {
        const ids = response.seats.map(seat => seat.showtimeSeatId);
        owned.current = { userId, ids: new Set(ids) };
        setReceipt({ userId, booking: response });
        queryClient.setQueryData(seatMapKeys.seats(showtimeId), previous => applySeatStatusUpdate(previous, { seatIds: ids, status: 'LOCKED' }));
      } else {
        savedCode(userId, showtimeId, null);
      }
      setRestoration({ userId, pending: false, error: false });
    }).catch(error => {
      if (controller.signal.aborted) return;
      const gone = [403, 404].includes(error?.response?.status);
      if (gone) savedCode(userId, showtimeId, null);
      setRestoration({ userId, pending: false, error: !gone });
    });
    return () => controller.abort();
  }, [userId, showtimeId, queryClient, restoreAttempt]);

  function patchSeats(ids, status) {
    queryClient.setQueryData(queryKey, previous => applySeatStatusUpdate(previous, { seatIds: ids, status }));
  }

  useEffect(() => {
    if (!booking) return undefined;
    const timer = window.setTimeout(() => {
      owned.current = null;
      setReceipt(null);
      savedCode(userId, showtimeId, null);
      queryClient.invalidateQueries({ queryKey: seatMapKeys.seats(showtimeId) });
      toast.info('Thời gian giữ ghế đã hết. Vui lòng chọn lại ghế.', { id: 'hold-expired' });
    }, Math.max(0, getHoldExpiry(booking.expiresAt) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [booking, userId, showtimeId, queryClient]);

  // HOLD can arrive before the POST response; only the submitted IDs are silenced.
  function isOwnHoldSeat(id) {
    const auth = useAuthStore.getState();
    if (!auth.isAuthenticated) return false;
    const currentUserId = auth.user?.id;
    const pending = submitting.current;
    const held = owned.current;
    return Boolean(
      (pending && pending.userId === currentUserId && pending.ids.has(id)) ||
      (held && held.userId === currentUserId && held.ids.has(id))
    );
  }

  function handleSeatUpdate(message) {
    const held = owned.current;
    if (message.status !== 'AVAILABLE' || busy.current || !held
      || held.userId !== useAuthStore.getState().user?.id
      || !message.seatIds.some(id => held.ids.has(id))) return;
    owned.current = null;
    setReceipt(null);
    savedCode(held.userId, showtimeId, null);
    toast.info('Đơn giữ ghế đã được giải phóng. Bạn có thể chọn lại.', { id: 'hold-released' });
  }

  async function holdSeats(internalShowtimeId, units) {
    if (busy.current || booking || restoration.pending || restoration.error) return false;
    const auth = useAuthStore.getState();
    if (!auth.isAuthenticated || auth.user?.id == null) {
      auth.openAuthModal('login');
      return false;
    }
    let payload;
    try {
      payload = buildHoldRequest(internalShowtimeId, units);
    } catch (error) {
      toast.warning(error.message, { id: 'hold-error' });
      return false;
    }
    busy.current = true;
    setOperation('creating');
    submitting.current = { userId: auth.user.id, ids: new Set(payload.showtimeSeatIds) };
    try {
      const response = await createMutation.mutateAsync(payload);
      if (!response?.bookingCode || !Array.isArray(response.seats) || !Number.isFinite(getHoldExpiry(response.expiresAt))) {
        throw new Error('Không nhận được thông tin giữ ghế hợp lệ. Vui lòng tải lại sơ đồ.');
      }
      savedCode(auth.user.id, showtimeId, response.bookingCode);
      // Do not display one account's receipt after the user has switched accounts.
      if (useAuthStore.getState().user?.id !== auth.user.id) return false;
      const ids = response.seats.map(seat => seat.showtimeSeatId);
      await queryClient.cancelQueries({ queryKey });
      owned.current = { userId: auth.user.id, ids: new Set(ids) };
      setReceipt({ userId: auth.user.id, booking: response });
      patchSeats(ids, 'LOCKED');
      toast.success('Giữ ghế thành công! Bạn có 10 phút để hoàn tất đặt vé.', { id: 'hold-success' });
      return true;
    } catch (error) {
      if (useAuthStore.getState().isAuthenticated) {
        toast.error(getHoldErrorMessage(error), { id: 'hold-error' });
      }
      // Refresh on 409 and uncertain network failures; never retry POST automatically.
      await queryClient.invalidateQueries({ queryKey });
      return false;
    } finally {
      submitting.current = null;
      busy.current = false;
      setOperation(null);
    }
  }

  async function cancelHold() {
    if (busy.current || !booking) return;
    busy.current = true;
    setOperation('cancelling');
    try {
      await cancelMutation.mutateAsync(booking.bookingCode);
      await queryClient.cancelQueries({ queryKey });
      savedCode(userId, showtimeId, null);
      if (useAuthStore.getState().user?.id === userId) {
        owned.current = null;
        setReceipt(null);
      }
      patchSeats(booking.seats.map(seat => seat.showtimeSeatId), 'AVAILABLE');
      await queryClient.invalidateQueries({ queryKey });
      toast.success('Đã hủy giữ ghế. Bạn có thể chọn lại.', { id: 'hold-cancelled' });
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Chưa hủy được giữ ghế. Vui lòng thử lại.', { id: 'hold-error' });
    } finally {
      busy.current = false;
      setOperation(null);
    }
  }

  return {
    booking,
    isRestoring: restoration.pending,
    restoreError: restoration.error,
    retryRestore: () => {
      setRestoration({ userId, pending: true, error: false });
      setRestoreAttempt(attempt => attempt + 1);
    },
    isCreating: operation === 'creating',
    isCancelling: operation === 'cancelling',
    submittedIds: operation === 'creating' ? createMutation.variables?.showtimeSeatIds ?? [] : [],
    holdSeats, cancelHold, isOwnHoldSeat, handleSeatUpdate,
  };
}
