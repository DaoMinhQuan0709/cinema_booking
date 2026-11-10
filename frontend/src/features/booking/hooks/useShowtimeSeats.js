import { useQuery } from '@tanstack/react-query';
import { showtimeService } from '../../../services/showtimeService';
import { isInternalShowtimeId, retryShowtimeRequest } from '../../../utils/showtimeId';

export const seatMapKeys = {
  seats: (showtimeId) => ['showtimes', 'seats', String(showtimeId)],
  detail: (showtimeId) => ['showtimes', 'detail', String(showtimeId)],
};

/**
 * So do ghe + trang thai cua 1 suat chieu (GET /showtimes/{id}/seats).
 * Khong cache lau: trang thai ghe thay doi lien tuc (cap nhat real-time se bo sung bang WebSocket).
 */
export function useShowtimeSeats(showtimeId) {
  return useQuery({
    queryKey: seatMapKeys.seats(showtimeId),
    queryFn: () => showtimeService.getShowtimeSeats(showtimeId),
    enabled: isInternalShowtimeId(showtimeId),
    retry: retryShowtimeRequest,
    staleTime: 0,
    refetchInterval: 30 * 1000,
    gcTime: 60 * 1000,
  });
}

/** Thong tin suat chieu (phim, rap, phong, gio chieu) - GET /showtimes/{id}. */
export function useShowtimeDetail(showtimeId) {
  return useQuery({
    queryKey: seatMapKeys.detail(showtimeId),
    queryFn: () => showtimeService.getShowtimeById(showtimeId),
    enabled: isInternalShowtimeId(showtimeId),
    retry: retryShowtimeRequest,
    staleTime: 60 * 1000,
  });
}
