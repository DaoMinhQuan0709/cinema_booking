import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../auth/authStore';
import { adminService } from '../../../services/adminService';
import { adminKeys } from '../adminKeys';
import { retryAdminQuery } from '../adminErrors';

export function useVerifiedAdmin() {
  return useAuthStore(state => state.sessionStatus === 'authenticated' && state.user?.role === 'ADMIN');
}

function useAdminQuery(queryKey, queryFn, options = {}) {
  const verified = useVerifiedAdmin();
  return useQuery({ queryKey, queryFn, staleTime: 30_000, retry: retryAdminQuery, ...options, enabled: verified && options.enabled !== false });
}

export function useAdminMovies(params = {}) {
  return useAdminQuery(adminKeys.movieList(params), ({ signal }) => adminService.getMovies(params, { signal }), { placeholderData: keepPreviousData });
}

export function useAdminMovieOptions(params = {}) {
  return useAdminQuery(adminKeys.movieOptionList(params), ({ signal }) => adminService.getMovieOptions(params, { signal }));
}

export function useAdminCinemas(params = {}) {
  return useAdminQuery(adminKeys.cinemaList(params), ({ signal }) => adminService.getCinemas(params, { signal }), { staleTime: 30 * 60_000 });
}

export function useAdminShowtimes(params = {}) {
  return useAdminQuery(adminKeys.showtimeList(params), ({ signal }) => adminService.getShowtimes(params, { signal }));
}

export function useAdminRevenue(params = {}, options = {}) {
  return useAdminQuery(adminKeys.revenue(params), ({ signal }) => adminService.getRevenue(params, { signal }), options);
}

export function useAdminOccupancy(params = {}) {
  return useAdminQuery(adminKeys.occupancy(params), ({ signal }) => adminService.getOccupancy(params, { signal }));
}

export function useAdminSyncStatus(options = {}) {
  return useAdminQuery(adminKeys.syncStatus, ({ signal }) => adminService.getSyncStatus({ signal }), options);
}
