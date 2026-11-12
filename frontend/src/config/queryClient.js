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
