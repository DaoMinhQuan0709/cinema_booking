import { useId, useState } from 'react';
import { LoaderCircle, Save } from 'lucide-react';
import { getVietnamClock } from '../showtimes/scheduleUtils';
import AdminField from './components/AdminField';
import AdminModal from './components/AdminModal';
import { useCreateShowtime } from './hooks/useAdminMutations';
import { ADMIN_MOVIE_STATUSES } from './movieForm';
import { prepareShowtime, suggestShowtimeEnd, toShowtimeForm } from './showtimeForm';

const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export default function ShowtimeFormModal({ filters, movies, cinemas, onClose, onSaved, onCheckList }) {
  const [values, setValues] = useState(() => {
    const draft = toShowtimeForm(filters);
    if (!movies.some(movie => String(movie.id) === draft.movieId)) draft.movieId = '';
    if (!cinemas.some(cinema => String(cinema.id) === draft.cinemaId)) draft.cinemaId = '';
    draft.endTime = suggestShowtimeEnd(draft.startTime, movies.find(movie => String(movie.id) === draft.movieId)?.durationMinutes);
    return draft;
  });
  const [manualEnd, setManualEnd] = useState(false);
  const [clientErrors, setClientErrors] = useState({});
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState('');
  const save = useCreateShowtime();
  const errors = { ...save.fieldErrors, ...clientErrors };
  const movie = movies.find(item => String(item.id) === values.movieId);
  const cinema = cinemas.find(item => String(item.id) === values.cinemaId);
  const rooms = cinema?.auditoriums || [];
  const suggested = suggestShowtimeEnd(values.startTime, movie?.durationMinutes);
  const formId = useId();

  function change(event) {
    const { name, value } = event.target;
    const cleared = [name];
    if (name === 'endTime') setManualEnd(true);
    if (name === 'cinemaId') cleared.push('auditoriumId');
    if (!manualEnd && (name === 'movieId' || name === 'startTime')) cleared.push('endTime');
    setValues(previous => {
      const next = { ...previous, [name]: value };
      if (name === 'cinemaId') next.auditoriumId = '';
      if (!manualEnd && (name === 'movieId' || name === 'startTime')) next.endTime = suggestShowtimeEnd(next.startTime, movies.find(item => String(item.id) === next.movieId)?.durationMinutes);
      return next;
    });
    setClientErrors(previous => Object.fromEntries(Object.entries(previous).filter(([field]) => !cleared.includes(field))));
    cleared.forEach(save.clearFieldError);
  }

  function useSuggestion() {
    setValues(previous => ({ ...previous, endTime: suggested }));
    setManualEnd(false);
    setClientErrors(previous => Object.fromEntries(Object.entries(previous).filter(([field]) => field !== 'endTime')));
    save.clearFieldError('endTime');
  }

  async function submit(event) {
    event.preventDefault();
    if (save.isPending || checking) return;
    const { errors: validation, payload } = prepareShowtime(values, { movies, cinemas });
    setClientErrors(validation);
    if (Object.keys(validation).length) {
      const form = event.currentTarget;
      requestAnimationFrame(() => { if (form.isConnected) form.elements.namedItem(Object.keys(validation)[0])?.focus(); });
      return;
    }
    try { onSaved(await save.mutateAsync(payload)); }
    catch { /* The mutation owns server errors/toasts; retain the draft. */ }
  }

  async function checkList() {
    setChecking(true); setCheckMessage('');
    try {
      await onCheckList();
      setCheckMessage('Danh sách đã được làm mới. Đóng biểu mẫu để đối chiếu ngày, rạp và phim trước khi gửi lại.');
    } catch { setCheckMessage('Chưa tải lại được danh sách. Vui lòng thử lại trước khi gửi lại biểu mẫu.'); }
    finally { setChecking(false); }
  }

  return (
    <AdminModal open title="Thêm suất chiếu" description="Xếp lịch theo giờ Việt Nam (UTC+7). Giá vé cơ bản tính bằng VND." onClose={onClose} busy={save.isPending}
      footer={<>
        <button type="button" onClick={onClose} disabled={save.isPending} className={`${buttonClass} border border-surfaceBorder text-neutral-300 hover:bg-white/5`}>Hủy</button>
        <button type="submit" form={formId} disabled={save.isPending || checking} className={`${buttonClass} bg-primary text-white hover:bg-primaryHover`}>
          {save.isPending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Save aria-hidden="true" className="h-4 w-4" />}
          {save.isPending ? 'Đang lưu…' : 'Lưu suất chiếu'}
        </button>
      </>}>
      <form id={formId} onSubmit={submit} noValidate className="space-y-5">
        {(save.formError || Object.keys(clientErrors).length > 0) && <div role="alert" className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-red-300">
          {save.formError || 'Vui lòng kiểm tra các trường được đánh dấu.'}
          {save.outcomeUncertain && <button type="button" onClick={() => void checkList()} disabled={checking} className={`${buttonClass} mt-3 border border-surfaceBorder text-white`}>
            {checking ? 'Đang kiểm tra…' : 'Kiểm tra lại danh sách'}
          </button>}
        </div>}
        {checkMessage && <p role="status" className="text-sm text-muted">{checkMessage}</p>}
        <fieldset disabled={save.isPending} className="grid min-w-0 gap-5 sm:grid-cols-2">
          <div className="min-w-0 sm:col-span-2"><AdminField label="Phim" required error={errors.movieId} hint={movie ? `Thời lượng ${movie.durationMinutes} phút; thêm 15 phút chuẩn bị phòng vào giờ kết thúc gợi ý.` : 'Chọn phim để gợi ý giờ kết thúc.'}>
            <select name="movieId" value={values.movieId} onChange={change}>
              <option value="">Chọn phim</option>
              {movies.map(item => <option key={item.id} value={item.id}>{item.title} · {item.durationMinutes} phút · {ADMIN_MOVIE_STATUSES.find(status => status.value === item.status)?.label || item.status}</option>)}
            </select>
          </AdminField></div>
          <AdminField label="Rạp" required error={errors.cinemaId}>
            <select name="cinemaId" value={values.cinemaId} onChange={change}>
              <option value="">Chọn rạp</option>
              {cinemas.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </AdminField>
          <AdminField label="Phòng chiếu" required error={errors.auditoriumId} hint={cinema && !rooms.length ? 'Rạp này chưa có phòng chiếu. Hãy chọn rạp khác.' : !cinema ? 'Chọn rạp trước khi chọn phòng.' : undefined}>
            <select name="auditoriumId" value={values.auditoriumId} onChange={change} disabled={!rooms.length}>
              <option value="">Chọn phòng chiếu</option>
              {rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
            </select>
          </AdminField>
          <div className="min-w-0"><AdminField label="Bắt đầu (giờ Việt Nam)" required error={errors.startTime}>
            <input name="startTime" type="datetime-local" step="60" min={getVietnamClock().dateTime.slice(0, 16)} max="9999-12-31T23:59" value={values.startTime} onChange={change} className="min-w-0 [color-scheme:dark]" />
          </AdminField></div>
          <div className="min-w-0 space-y-2"><AdminField label="Kết thúc (giờ Việt Nam)" required error={errors.endTime} hint={manualEnd ? 'Đang dùng giờ bạn chỉnh. Đổi phim/giờ bắt đầu sẽ giữ mốc này.' : 'Tự cập nhật theo phim và giờ bắt đầu; bạn có thể chỉnh lại.'}>
            <input name="endTime" type="datetime-local" step="60" max="9999-12-31T23:59" value={values.endTime} onChange={change} className="min-w-0 [color-scheme:dark]" />
          </AdminField>
            {manualEnd && suggested && <button type="button" onClick={useSuggestion} className="min-h-10 rounded-lg px-2 text-xs font-semibold text-white underline underline-offset-4 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Dùng giờ gợi ý</button>}
          </div>
          <div className="min-w-0 sm:col-span-2"><AdminField label="Giá vé cơ bản (VND)" required error={errors.basePrice} hint="Chưa gồm phụ thu loại ghế và combo.">
            <input name="basePrice" type="number" inputMode="decimal" min="0.01" max="99999999.99" step="0.01" value={values.basePrice} onChange={change} placeholder="Ví dụ: 90000" />
          </AdminField></div>
        </fieldset>
      </form>
    </AdminModal>
  );
}
