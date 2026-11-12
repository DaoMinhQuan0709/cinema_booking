import { useState } from 'react';
import AdminTable from '../../src/features/admin/components/AdminTable';
import AdminModal from '../../src/features/admin/components/AdminModal';
import AdminField from '../../src/features/admin/components/AdminField';
import { useAdminMovies, useAdminMovieOptions, useAdminCinemas, useAdminShowtimes, useAdminRevenue, useAdminOccupancy, useAdminSyncStatus } from '../../src/features/admin/hooks/useAdminQueries';
import { useCreateMovie, useUpdateMovie, useCreateShowtime, useSyncLocalFile } from '../../src/features/admin/hooks/useAdminMutations';

const movie = { title: 'Phim thử nghiệm', description: 'Mô tả', durationMinutes: 90, releaseDate: '2027-01-02',
  posterUrl: 'https://example.invalid/poster.jpg', trailerUrl: 'https://example.invalid/trailer', genre: 'Drama', ageRating: 'T13', status: 'NOW_SHOWING' };
const showtime = { movieId: 7, auditoriumId: 3, startTime: '2027-01-02T19:00:00', endTime: '2027-01-02T20:45:00', basePrice: 90000 };

function ReadProbe() {
  const movies = useAdminMovieOptions({ size: 1 });
  const cinemas = useAdminCinemas({ city: 'Hồ Chí Minh' });
  const showtimes = useAdminShowtimes({ movieId: 7, cinemaId: 2, date: '2027-01-02' });
  const revenue = useAdminRevenue({ startDate: '2027-01-01', endDate: '2027-01-31', movieId: 7, cinemaId: 2, groupBy: 'movie' });
  const occupancy = useAdminOccupancy({ date: '2027-01-02', movieId: 7, cinemaId: 2 });
  const sync = useAdminSyncStatus();
  return <output data-read-status>{JSON.stringify({ movies: movies.data?.content.length, cinemas: cinemas.data?.length,
    showtimes: showtimes.data?.length, revenue: revenue.data?.totalRevenue, occupancy: occupancy.data?.totalSeats, lastSuccessAt: sync.data?.lastSuccessAt })}</output>;
}

export default function AdminFoundationProbe({ mode }) {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(movie);
  const query = useAdminMovies({ page, size: 1, keyword: mode === 'empty' ? 'empty' : 'test' });
  const create = useCreateMovie();
  const update = useUpdateMovie();
  const addShowtime = useCreateShowtime();
  const sync = useSyncLocalFile();
  const change = event => {
    const { name, value } = event.target;
    setValues(previous => ({ ...previous, [name]: name === 'durationMinutes' ? Number(value) : value }));
    create.clearFieldError(name);
  };
  const submit = async event => {
    event.preventDefault();
    try {
      await create.mutateAsync({ ...values, id: 999, uiOnly: 'must not be submitted' });
      setOpen(false);
    } catch { /* Keep the draft and show hook-owned errors. */ }
  };
  return (
    <section aria-label="Foundation test fixture" className="min-w-0 space-y-5 p-4">
      {mode === 'all' && <ReadProbe />}
      <div className="flex flex-wrap gap-4">
        <button type="button" data-open-form onClick={() => { create.reset(); setOpen(true); }}>Mở biểu mẫu thử</button>
        <button type="button" data-update disabled={update.isPending} onClick={() => update.mutate({ ...movie, id: 7, title: 'Phim đã sửa' })}>Sửa phim thử</button>
        <button type="button" data-showtime disabled={addShowtime.isPending} onClick={() => addShowtime.mutate({ ...showtime, cinemaId: 2 })}>Thêm suất thử</button>
        <button type="button" data-sync disabled={sync.isPending} onClick={() => sync.mutate({ limitShowtimes: 25 })}>Nhập mẫu thử</button>
      </div>
      <output data-write-error>{update.formError || addShowtime.formError || sync.formError}</output>
      <AdminTable columns={[{ key: 'title', label: 'Tên phim' }, { key: 'description', label: 'Mô tả' }]}
        rows={query.data?.content || []} caption="Danh sách phim thử nghiệm" loading={query.isPending && query.fetchStatus !== 'idle'} fetching={query.isFetching}
        error={query.error} onRetry={() => void query.refetch()} pagination={query.data} onPageChange={setPage}
        emptyTitle="Không có phim phù hợp" emptyDescription="Hãy đổi bộ lọc." />
      <AdminModal open={open} title="Thêm phim thử nghiệm" description="Biểu mẫu kiểm thử dùng UI và mutation thật, API mô phỏng."
        busy={create.isPending} onClose={() => setOpen(false)} footer={
          <button form="admin-probe-form" type="submit" disabled={create.isPending}>{create.isPending ? 'Đang lưu…' : 'Lưu phim thử'}</button>
        }>
        <form id="admin-probe-form" onSubmit={submit} className="space-y-4">
          {create.formError && <p role="alert" data-form-error>{create.formError}</p>}
          <fieldset disabled={create.isPending} className="space-y-4">
            <AdminField label="Tên phim" required error={create.fieldErrors.title}>
              <input name="title" value={values.title} onChange={change} />
            </AdminField>
            <AdminField label="Thời lượng" required error={create.fieldErrors.durationMinutes} hint="Đơn vị phút">
              <input name="durationMinutes" type="number" value={values.durationMinutes} onChange={change} />
            </AdminField>
          </fieldset>
        </form>
      </AdminModal>
    </section>
  );
}
