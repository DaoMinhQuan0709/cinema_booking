import { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import AdminField from './components/AdminField';
import { validateRevenueRange } from './reportUtils';

const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-surfaceBorder px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export function ReportCatalogFilters({ filters, moviesQuery, cinemasQuery, onChange, onReset }) {
  const fields = [
    { name: 'cinemaId', label: 'Rạp', items: cinemasQuery.data || [], ready: Boolean(cinemasQuery.data), all: 'Tất cả rạp' },
    { name: 'movieId', label: 'Phim', items: moviesQuery.data?.content || [], ready: Boolean(moviesQuery.data), all: 'Tất cả phim' },
  ];
  return <div className="mb-8 rounded-2xl border border-surfaceBorder bg-surface/30 p-4 sm:p-5">
    <p className="mb-4 text-xs font-medium text-muted">Rạp và phim áp dụng cho cả doanh thu và tỷ lệ lấp đầy.</p>
    <div id="admin-report-catalog-filters" className="grid min-w-0 items-end gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
      {fields.map(({ name, label, items, ready, all }) => <div key={name} className="min-w-0"><AdminField label={label}>
        <select name={name} value={filters[name]} disabled={!ready} onChange={event => onChange({ [name]: event.target.value })} className="min-w-0">
          <option value="">{all}</option>
          {filters[name] && !items.some(item => String(item.id) === filters[name]) && <option value={filters[name]}>{label} #{filters[name]} (ngoài danh mục hiện tại)</option>}
          {items.map(item => <option key={item.id} value={item.id}>{item.title || item.name} · #{item.id}</option>)}
        </select>
      </AdminField></div>)}
      <button type="button" onClick={onReset} className={`${buttonClass} justify-self-start`}><RotateCcw aria-hidden="true" className="h-4 w-4" />Đặt lại bộ lọc</button>
    </div>
  </div>;
}

export function RevenueDateFilters({ filters, onApply }) {
  const [draft, setDraft] = useState({ startDate: filters.startDate, endDate: filters.endDate });
  const [errors, setErrors] = useState(() => validateRevenueRange(filters));
  function change(event) {
    const { name, value } = event.target;
    setDraft(previous => ({ ...previous, [name]: value })); setErrors({});
  }
  function submit(event) {
    event.preventDefault();
    const validation = validateRevenueRange(draft); setErrors(validation);
    if (Object.keys(validation).length) {
      const form = event.currentTarget;
      requestAnimationFrame(() => form.isConnected && form.elements.namedItem(Object.keys(validation)[0])?.focus());
    } else onApply(draft);
  }
  return <form id="admin-revenue-date-filters" aria-label="Khoảng ngày doanh thu" onSubmit={submit} noValidate className="mb-5 grid min-w-0 items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
    <div className="min-w-0"><AdminField label="Từ ngày tạo đơn" required error={errors.startDate}>
      <input name="startDate" type="date" max="9999-12-31" value={draft.startDate} onChange={change} className="min-w-0 [color-scheme:dark]" />
    </AdminField></div>
    <div className="min-w-0"><AdminField label="Đến hết ngày" required error={errors.endDate}>
      <input name="endDate" type="date" max="9999-12-31" value={draft.endDate} onChange={change} className="min-w-0 [color-scheme:dark]" />
    </AdminField></div>
    <button type="submit" className={buttonClass}><Check aria-hidden="true" className="h-4 w-4" />Áp dụng ngày</button>
  </form>;
}
