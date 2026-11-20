import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => ![401, 403].includes(error?.response?.status) && failureCount < 1,
    },
  },
});

// All Admin query and mutation keys must start with ['admin'].
export function clearAdminCache() {
  void queryClient.cancelQueries({ queryKey: ['admin'] });
  queryClient.removeQueries({ queryKey: ['admin'] });
  const mutations = queryClient.getMutationCache();
  mutations.getAll().forEach(mutation => {
    if (mutation.options.mutationKey?.[0] === 'admin') mutations.remove(mutation);
  });
}

/**
 * Hủy và xóa cache vé khỏi queryClient để không lộ dữ liệu giữa các phiên.
 * - Nếu truyền sessionId: chỉ xóa cache của phiên đó (dùng khi biết phiên cũ).
 * - Nếu không truyền: xóa toàn bộ cache my-tickets (dùng khi logout hoàn toàn).
 * gcTime: 0 đảm bảo GC sạch sau khi observer unsubscribe, nhưng cancel + remove
 * ngay tại đây để request đang chờ bị abort và dữ liệu không được đọc bởi phiên mới.
 */
export function clearTicketCache(sessionId) {
  const queryKey = sessionId ? ['my-tickets', sessionId] : ['my-tickets'];
  void queryClient.cancelQueries({ queryKey });
  queryClient.removeQueries({ queryKey });
}

/**
 * Đánh dấu dữ liệu vé cần được làm mới (stale/refetch) sau khi tạo đơn, hủy đơn, hoặc thanh toán.
 */
export function invalidateTicketCache(sessionId) {
  if (!sessionId) return Promise.resolve();
  return queryClient.invalidateQueries({ queryKey: ['my-tickets', sessionId] });
}
