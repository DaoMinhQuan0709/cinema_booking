import { useQuery } from '@tanstack/react-query';
import { showtimeService } from '../../../services/showtimeService';
import { showtimeKeys } from '../../movies/hooks/useShowtimes';
import { retryShowtimeRequest } from '../../../utils/showtimeId';

export function useDailyShowtimes(date) {
  const params = { date };
  return useQuery({
    queryKey: showtimeKeys.list(params),
    queryFn: ({ signal }) => showtimeService.getShowtimes(params, { signal, skipErrorToast: true }),
    enabled: Boolean(date),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    retry: retryShowtimeRequest,
  });
}
