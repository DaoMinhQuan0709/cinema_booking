import { useEffect, useEffectEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeShowtimeSeats } from '../config/websocketClient';
import { seatMapKeys } from '../features/booking/hooks/useShowtimeSeats';
import { applySeatStatusUpdate } from '../utils/seatRealtime';

/**
 * Lang nghe /topic/showtimes/{showtimeId}/seats va cap nhat thang vao cache
 * React Query cua so do ghe -> ghe doi mau ngay, khong can F5.
 *
 * - Moi message: vá trang thai cac ghe trong seatIds vao cache (khong goi lai API).
 * - Moi lan (re)connect: goi lai GET /showtimes/{id}/seats de dong bo, vi cac
 *   message gui luc mat ket noi se bi mat.
 *
 * @param {number|string} showtimeId
 * @param {{ enabled?: boolean, onSeatUpdate?: (message: object) => void }} [options]
 *   onSeatUpdate chay SAU khi cache da duoc cap nhat (dung de hien toast...).
 * @returns {{ isConnected: boolean }}
 */
export function useWebSocketSeatLock(showtimeId, { enabled = true, onSeatUpdate } = {}) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  // Luon goi ban moi nhat cua callback ma khong buoc effect phai subscribe lai
  const notify = useEffectEvent((message) => onSeatUpdate?.(message));

  useEffect(() => {
    if (!enabled || !showtimeId) return undefined;
    const queryKey = seatMapKeys.seats(showtimeId);

    return subscribeShowtimeSeats(showtimeId, {
      onMessage: (message) => {
        if (String(message.showtimeId) !== String(showtimeId)) return;
        queryClient.setQueryData(queryKey, (previous) => applySeatStatusUpdate(previous, message));
        notify(message);
      },
      onConnect: () => {
        setIsConnected(true);
        queryClient.invalidateQueries({ queryKey });
      },
      onDisconnect: () => setIsConnected(false),
    });
  }, [showtimeId, enabled, queryClient]);

  return { isConnected };
}
