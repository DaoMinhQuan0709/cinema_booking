import { useQuery } from '@tanstack/react-query';
import { cinemaService } from '../../../services/cinemaService';
import { cinemaKeys } from '../../movies/hooks/useShowtimes';
import { isInternalShowtimeId, retryShowtimeRequest } from '../../../utils/showtimeId';

/** Chi tiết rạp theo ID nội bộ; cache riêng với danh sách rạp trong 30 phút. */
export function useCinemaDetail(id) {
  const cinemaId = String(id ?? '');

  return useQuery({
    queryKey: cinemaKeys.detail(cinemaId),
    queryFn: ({ signal }) => cinemaService.getCinemaById(cinemaId, { signal, skipErrorToast: true }),
    enabled: isInternalShowtimeId(cinemaId),
    staleTime: 30 * 60 * 1000,
    retry: retryShowtimeRequest,
  });
}
