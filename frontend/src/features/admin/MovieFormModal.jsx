import { useId, useState } from 'react';
import { LoaderCircle, Save } from 'lucide-react';
import AdminField from './components/AdminField';
import AdminModal from './components/AdminModal';
import { useCreateMovie, useUpdateMovie } from './hooks/useAdminMutations';
import { ADMIN_MOVIE_STATUSES, prepareMovie, toMovieForm } from './movieForm';

const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export default function MovieFormModal({ movie, onClose, onSaved, onCheckList }) {
  const [values, setValues] = useState(() => toMovieForm(movie));
  const [clientErrors, setClientErrors] = useState({});
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState('');
  const create = useCreateMovie();
  const update = useUpdateMovie();
  const save = movie ? update : create;
  const errors = { ...save.fieldErrors, ...clientErrors };
  const formId = useId();
  const ratingsId = useId();

  function change(event) {
    const { name, value } = event.target;
    setValues(previous => ({ ...previous, [name]: value }));
    setClientErrors(previous => Object.fromEntries(Object.entries(previous).filter(([field]) => field !== name)));
    save.clearFieldError(name);
  }

  async function submit(event) {
    event.preventDefault();
    if (save.isPending || checking) return;
    const { errors: validation, payload } = prepareMovie(values);
    setClientErrors(validation);
    if (Object.keys(validation).length) {
      const form = event.currentTarget;
      requestAnimationFrame(() => { if (form.isConnected) form.elements.namedItem(Object.keys(validation)[0])?.focus(); });
      return;
    }
    try {
      const result = await save.mutateAsync(movie ? { id: movie.id, ...payload } : payload);
      onSaved(result, !movie);
    } catch { /* Hook owns server errors and toasts; keep this draft open. */ }
  }

  async function checkList() {
    setChecking(true);
    setCheckMessage('');
    try {
      await onCheckList();
      setCheckMessage('Danh sách đã được làm mới. Bạn có thể đóng biểu mẫu để đối chiếu trước khi lưu lại.');
    } catch {
      setCheckMessage('Chưa tải lại được danh sách. Vui lòng thử lại trước khi gửi lại biểu mẫu.');
    } finally { setChecking(false); }
  }

  return (
    <AdminModal open title={movie ? 'Sửa phim' : 'Thêm phim'} onClose={onClose} busy={save.isPending}
      description={movie ? `Cập nhật thông tin “${movie.title}”.` : 'Nhập thông tin phim và chọn trạng thái hiển thị.'}
      footer={<>
        <button type="button" onClick={onClose} disabled={save.isPending} className={`${buttonClass} border border-surfaceBorder text-neutral-300 hover:bg-white/5`}>Hủy</button>
        <button type="submit" form={formId} disabled={save.isPending || checking} className={`${buttonClass} bg-primary text-white hover:bg-primaryHover`}>
          {save.isPending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Save aria-hidden="true" className="h-4 w-4" />}
          {save.isPending ? 'Đang lưu…' : 'Lưu phim'}
        </button>
      </>}>
      <form id={formId} onSubmit={submit} noValidate className="space-y-5">
        {(save.formError || Object.keys(clientErrors).length > 0) && <div role="alert" className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-red-300">
          {save.formError || 'Vui lòng kiểm tra các trường được đánh dấu.'}
          {save.outcomeUncertain && <button type="button" onClick={() => void checkList()} disabled={checking}
            className="mt-3 block rounded-lg border border-surfaceBorder px-3 py-2 font-semibold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            {checking ? 'Đang kiểm tra…' : 'Kiểm tra lại danh sách'}
          </button>}
        </div>}
        {checkMessage && <p role="status" className="text-sm text-muted">{checkMessage}</p>}
        <fieldset disabled={save.isPending} className="grid min-w-0 gap-5 sm:grid-cols-2">
          <div className="min-w-0 sm:col-span-2"><AdminField label="Tên phim" required error={errors.title}>
            <input name="title" value={values.title} onChange={change} maxLength={255} autoComplete="off" />
          </AdminField></div>
          <AdminField label="Thời lượng (phút)" required error={errors.durationMinutes}>
            <input name="durationMinutes" type="number" inputMode="numeric" min="1" max="2147483647" step="1" value={values.durationMinutes} onChange={change} />
          </AdminField>
          <AdminField label="Ngày phát hành" required error={errors.releaseDate}>
            <input name="releaseDate" type="date" max="9999-12-31" value={values.releaseDate} onChange={change} className="min-w-0 [color-scheme:dark]" />
          </AdminField>
          <AdminField label="Trạng thái" required error={errors.status}>
            <select name="status" value={values.status} onChange={change}>
              <option value="" disabled>Chọn trạng thái</option>
              {ADMIN_MOVIE_STATUSES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </AdminField>
          <AdminField label="Phân loại độ tuổi" error={errors.ageRating} hint="Ví dụ: P, K, T13, T16, T18.">
            <input name="ageRating" list={ratingsId} maxLength={10} value={values.ageRating} onChange={change} />
          </AdminField>
          <datalist id={ratingsId}>{['P', 'K', 'T13', 'T16', 'T18'].map(value => <option key={value} value={value} />)}</datalist>
          <div className="min-w-0 sm:col-span-2"><AdminField label="Thể loại" error={errors.genre}>
            <input name="genre" maxLength={500} value={values.genre} onChange={change} placeholder="Ví dụ: Hành động, Phiêu lưu" />
          </AdminField></div>
          <div className="min-w-0 sm:col-span-2"><AdminField label="URL poster" error={errors.posterUrl} hint="Đường dẫn ảnh HTTP(S); có thể để trống.">
            <input name="posterUrl" type="url" maxLength={500} value={values.posterUrl} onChange={change} placeholder="https://…" />
          </AdminField></div>
          <div className="min-w-0 sm:col-span-2"><AdminField label="URL trailer" error={errors.trailerUrl} hint="Đường dẫn HTTP(S); website hỗ trợ phát trailer YouTube.">
            <input name="trailerUrl" type="url" maxLength={500} value={values.trailerUrl} onChange={change} placeholder="https://www.youtube.com/watch?v=…" />
          </AdminField></div>
          <div className="min-w-0 sm:col-span-2"><AdminField label="Mô tả" error={errors.description}>
            <textarea name="description" rows={4} value={values.description} onChange={change} className="resize-y" />
          </AdminField></div>
        </fieldset>
      </form>
    </AdminModal>
  );
}
