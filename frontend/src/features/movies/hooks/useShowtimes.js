import { useQuery } from '@tanstack/react-query';
import { showtimeService } from '../../../services/showtimeService';
import { cinemaService } from '../../../services/cinemaService';

export const showtimeKeys = {
  all: ['showtimes'],
  list: (params) => [...showtimeKeys.all, 'list', params],
};

export const cinemaKeys = {
  all: ['cinemas'],
  list: (params) => [...cinemaKeys.all, 'list', params],
};

/**
 * Lich chieu cua 1 phim trong 1 ngay (date: YYYY-MM-DD, gio dia phuong).
 * Tu dong khong goi API khi thieu movieId hoac date.
 * staleTime ngan (1 phut) vi suat chieu co the bi go / het han ban bat cu luc nao.
 */
export function useShowtimes({ movieId, date, cinemaId } = {}) {
  const params = { movieId, date, ...(cinemaId ? { cinemaId } : {}) };

  return useQuery({
    queryKey: showtimeKeys.list(params),
    queryFn: () => showtimeService.getShowtimes(params),
    enabled: Boolean(movieId && date),
    staleTime: 60 * 1000,
  });
}

/**
 * Toan bo cum rap (dung de tra cuu thanh pho cua tung rap, vi ShowtimeResponse
 * khong tra ve city). Du lieu it thay doi nen cache 30 phut.
 */
export function useCinemas(params = {}) {
  return useQuery({
    queryKey: cinemaKeys.list(params),
    queryFn: () => cinemaService.getCinemas(params),
    staleTime: 30 * 60 * 1000,
  });
}
