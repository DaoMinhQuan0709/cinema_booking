import { useQuery } from '@tanstack/react-query';
import { showtimeService } from '../../../services/showtimeService';
import { showtimeKeys } from '../../movies/hooks/useShowtimes';
import { isInternalShowtimeId, retryShowtimeRequest } from '../../../utils/showtimeId';

/** Toàn bộ phim tại một rạp/ngày (YYYY-MM-DD); không cần movieId. */
export function useCinemaShowtimes({ cinemaId, date } = {}) {
  const params = { cinemaId: String(cinemaId ?? ''), date };

  return useQuery({
    queryKey: showtimeKeys.list(params),
    queryFn: ({ signal }) => showtimeService.getShowtimes(params, { signal, skipErrorToast: true }),
    enabled: isInternalShowtimeId(params.cinemaId) && Boolean(date),
    staleTime: 60 * 1000,
    retry: retryShowtimeRequest,
  });
}
