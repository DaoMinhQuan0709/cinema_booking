import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '../../auth/authStore';
import { tokenStorage } from '../../../config/tokenStorage';
import { adminService } from '../../../services/adminService';
import { adminInvalidationKeys } from '../adminKeys';
import { getAdminError } from '../adminErrors';

function useAdminMutation({ name, mutationFn, invalidates, successMessage }) {
  const client = useQueryClient();
  const inFlight = useRef(null);
  const [failure, setFailure] = useState(null);
  const isCurrent = context => context?.sessionId != null && context.sessionId === tokenStorage.getSessionId();
  const mutation = useMutation({
    mutationKey: ['admin', 'mutation', name],
    retry: false,
    // Do not queue an offline write for automatic submission after reconnect/login.
    networkMode: 'always',
    mutationFn: variables => {
      const auth = useAuthStore.getState();
      if (auth.sessionStatus !== 'authenticated' || auth.user?.role !== 'ADMIN') {
        throw Object.assign(new Error('Phiên quản trị chưa được xác minh.'), { code: 'ERR_CANCELED' });
      }
      return mutationFn(variables);
    },
    onMutate: () => {
      setFailure(null);
      return { sessionId: tokenStorage.getSessionId() };
    },
    onSuccess: async (_data, _variables, context) => {
      if (!isCurrent(context)) return;
      await Promise.all(invalidates.map(queryKey => client.invalidateQueries({ queryKey })));
      if (isCurrent(context)) toast.success(successMessage);
    },
    onError: (error, _variables, context) => {
      if (!isCurrent(context)) return;
      const detail = getAdminError(error, { forMutation: true });
      if (detail.cancelled) return;
      setFailure(detail);
      if (Object.keys(detail.fieldErrors).length === 0) toast.error(detail.message);
    },
  });

  // A ref closes the gap before React renders isPending, including two submits in one tick.
  const mutateAsync = variables => {
    if (inFlight.current) return inFlight.current;
    const request = mutation.mutateAsync(variables).finally(() => {
      if (inFlight.current === request) inFlight.current = null;
    });
    inFlight.current = request;
    return request;
  };

  return {
    ...mutation,
    mutateAsync,
    mutate: variables => { void mutateAsync(variables).catch(() => {}); },
    fieldErrors: failure?.fieldErrors || {},
    formError: failure?.message || null,
    outcomeUncertain: failure?.uncertain || false,
    clearFieldError: name => setFailure(previous => previous ? { ...previous, fieldErrors: Object.fromEntries(Object.entries(previous.fieldErrors).filter(([key]) => key !== name)) } : null),
    reset: () => { mutation.reset(); setFailure(null); },
  };
}

export function useCreateMovie() {
  return useAdminMutation({ name: 'create-movie', mutationFn: adminService.createMovie,
    invalidates: adminInvalidationKeys.movie, successMessage: 'Đã thêm phim.' });
}

export function useUpdateMovie() {
  return useAdminMutation({ name: 'update-movie', mutationFn: ({ id, ...payload }) => adminService.updateMovie(id, payload),
    invalidates: adminInvalidationKeys.movie, successMessage: 'Đã cập nhật phim.' });
}

export function useCreateShowtime() {
  return useAdminMutation({ name: 'create-showtime', mutationFn: adminService.createShowtime,
    invalidates: adminInvalidationKeys.showtime, successMessage: 'Đã thêm suất chiếu.' });
}

export function useSyncLocalFile() {
  return useAdminMutation({ name: 'sync-local-file', mutationFn: adminService.syncLocalFile,
    invalidates: adminInvalidationKeys.sync, successMessage: 'Đã nhập dữ liệu Galaxy mẫu.' });
}
