import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../../src/config/axiosInstance';

export default function AdminProbe() {
  const { data } = useQuery({
    queryKey: ['admin', 'probe'],
    queryFn: async ({ signal }) => {
      signal.addEventListener('abort', () => { window.__adminProbe.aborted++; });
      const { data } = await axiosInstance.get('/admin/probe', { signal, skipErrorToast: true });
      return data;
    },
  });
  return <p data-admin-probe>{data?.label || 'Loading protected query'}</p>;
}
