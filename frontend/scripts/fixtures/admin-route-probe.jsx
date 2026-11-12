// Test-only lazy child. Vite serves this fixture in development; it is not a build entry.
import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import AdminRoute from '../../src/routes/AdminRoute';
import { queryClient } from '../../src/config/queryClient';
import { tokenStorage } from '../../src/config/tokenStorage';
import axiosInstance from '../../src/config/axiosInstance';
import { useAuthStore } from '../../src/features/auth/authStore';
import { adminService } from '../../src/services/adminService';

export const testApi = { queryClient, tokenStorage, axiosInstance, adminService, auth: useAuthStore };

export async function mountFoundationProbe(mode = 'movies', guarded = true) {
  const { default: FoundationProbe } = await import('./AdminFoundationProbe');
  const container = document.createElement('div');
  container.id = 'admin-foundation-probe';
  document.body.append(container);
  const content = <FoundationProbe mode={mode} />;
  createRoot(container).render(<QueryClientProvider client={queryClient}>
    {guarded ? <MemoryRouter initialEntries={['/admin/foundation']}><Routes>
      <Route path="/admin" element={<AdminRoute />}><Route path="foundation" element={content} /></Route>
    </Routes></MemoryRouter> : content}
  </QueryClientProvider>);
}

export function mountAdminProbe() {
  window.__adminProbe = { lazyLoads: 0, aborted: 0 };
  const Child = lazy(() => {
    window.__adminProbe.lazyLoads++;
    return import('./AdminProbe');
  });
  const container = document.createElement('div');
  container.id = 'admin-probe';
  document.body.append(container);
  createRoot(container).render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/probe']}>
        <Routes>
          <Route path="/admin" element={<AdminRoute />}>
            <Route path="probe" element={<Suspense fallback="Loading probe"><Child /></Suspense>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
