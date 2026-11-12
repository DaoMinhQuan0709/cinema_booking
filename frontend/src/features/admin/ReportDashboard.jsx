import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Banknote, ClipboardCheck, RefreshCw, Ticket, TriangleAlert } from 'lucide-react';
import AdminField from './components/AdminField';
import AdminTable from './components/AdminTable';
import { AdminEmpty, AdminError, AdminLoading } from './components/AdminStates';
import { useAdminCinemas, useAdminMovieOptions, useAdminOccupancy, useAdminRevenue } from './hooks/useAdminQueries';
import { ReportCatalogFilters, RevenueDateFilters } from './ReportFilters';
import ReportRevenueChart from './ReportRevenueChart';
import { formatMovieDate, isCalendarDate } from './movieForm';
import { CAPACITY_SOURCES, defaultReportFilters, formatReportCount, formatReportMoney, formatReportPercent, readReportFilters, reportNumber, validateRevenueRange, writeReportFilters } from './reportUtils';

const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-surfaceBorder px-4 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function RefreshReport({ query, label, disabled = false }) {
  return <button type="button" disabled={disabled || query.isFetching} onClick={() => void query.refetch()} className={buttonClass}>
    <RefreshCw aria-hidden="true" className={`h-4 w-4 ${query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} />{label}
  </button>;
}

function ReportQueryContent({ query, title, loadingLabel, children }) {
  if (query.isPending) return <AdminLoading label={loadingLabel} />;
  if (!query.data) return <AdminError title={title} error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  return <div aria-busy={query.isFetching} className="min-w-0 space-y-5">
    {query.isError && <div className="space-y-2"><AdminError title={title} error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      <p className="text-xs text-muted">Đang hiển thị dữ liệu đã tải trước đó cho bộ lọc này.</p></div>}
    {query.isFetching && <p role="status" className="text-xs text-muted">Đang cập nhật báo cáo…</p>}
    {children}
  </div>;
}

function Metric({ id, label, value, hint, icon: Icon, emphasis = false }) {
  return <div className={`min-w-0 rounded-2xl border p-5 ${emphasis ? 'border-primary/30 bg-primary/[0.06]' : 'border-surfaceBorder bg-surface/30'}`}>
    <dt className="flex items-center gap-2 text-sm text-muted">{Icon && <Icon aria-hidden="true" className={`h-4 w-4 ${emphasis ? 'text-primary' : ''}`} />}{label}</dt>
    <dd className="mt-4"><span id={id} className="block break-words font-display text-3xl font-bold tabular-nums leading-tight text-white sm:text-[2rem]">{value}</span>
      <p className="mt-3 text-xs leading-relaxed text-muted">{hint}</p></dd>
  </div>;
}

function ReportDetailsTable({ columns, rows, caption, rowKey }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(rows.length / 20);
  const current = Math.min(page, Math.max(0, totalPages - 1));
  return <div className="min-w-0">
    <p className="mb-3 text-xs text-muted sm:hidden">Vuốt ngang trong bảng để xem đủ các cột.</p>
    <AdminTable columns={columns} rows={rows.slice(current * 20, (current + 1) * 20)} rowKey={rowKey} caption={caption}
      pagination={rows.length > 20 ? { pageNo: current, totalPages, totalElements: rows.length } : undefined} onPageChange={setPage} />
  </div>;
}

export default function ReportDashboard() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [resetVersion, setResetVersion] = useState(0);
  const filters = readReportFilters(params);
  const currentSearch = params.toString();
  const canonical = writeReportFilters(params, filters).toString();
  const validRange = Object.keys(validateRevenueRange(filters)).length === 0;
  const commonParams = { ...(filters.cinemaId ? { cinemaId: filters.cinemaId } : {}), ...(filters.movieId ? { movieId: filters.movieId } : {}) };
  const revenueQuery = useAdminRevenue({ ...commonParams, startDate: filters.startDate, endDate: filters.endDate, groupBy: filters.groupBy }, { enabled: validRange });
  const occupancyQuery = useAdminOccupancy({ ...commonParams, date: filters.occupancyDate });
  const moviesQuery = useAdminMovieOptions({ size: 100, sort: 'title,asc' });
  const cinemasQuery = useAdminCinemas();
  const revenue = revenueQuery.data;
  const occupancy = occupancyQuery.data;
  const revenueRows = Array.isArray(revenue?.breakdown) ? revenue.breakdown : [];
  const occupancyRows = Array.isArray(occupancy?.breakdown) ? occupancy.breakdown : [];
  const capacity = reportNumber(occupancy?.totalSeatsAvailable);
  const missingCapacity = reportNumber(occupancy?.showtimesMissingCapacity) || 0;

  useEffect(() => {
    if (canonical !== currentSearch) navigate({ pathname: location.pathname, search: canonical, hash: location.hash }, { replace: true, preventScrollReset: true });
  }, [canonical, currentSearch, location.pathname, location.hash, navigate]);

  function changeFilters(changes) {
    const next = writeReportFilters(params, { ...filters, ...changes });
    if (next.toString() !== currentSearch) navigate({ pathname: location.pathname, search: next.toString(), hash: location.hash }, { preventScrollReset: true });
  }

  const revenueColumns = [
    { key: 'label', label: filters.groupBy === 'cinema' ? 'Rạp' : 'Phim', render: row => <div className="min-w-44 max-w-sm break-words">
      <p className="font-medium text-white">{row.label}</p><p className="mt-1 text-xs text-muted">#{row.id}</p>
    </div> },
    { key: 'revenue', label: 'Doanh thu', className: 'whitespace-nowrap text-right tabular-nums', render: row => formatReportMoney(row.revenue) },
    { key: 'bookingCount', label: 'Đơn xác nhận', className: 'whitespace-nowrap text-right tabular-nums', render: row => formatReportCount(row.bookingCount) },
    { key: 'ticketCount', label: 'Vé đã bán', className: 'whitespace-nowrap text-right tabular-nums', render: row => formatReportCount(row.ticketCount) },
  ];
  const occupancyColumns = [
    { key: 'label', label: 'Suất chiếu', render: row => <div className="min-w-60 max-w-md break-words">
      <p className="font-medium leading-relaxed text-white">{row.label}</p><p className="mt-2 text-xs text-muted">Suất #{row.showtimeId}{row.active === false ? ' · Đã ngừng mở bán' : ''}</p>
    </div> },
    { key: 'bookedSeats', label: 'Đã bán', className: 'whitespace-nowrap text-right tabular-nums', render: row => formatReportCount(row.bookedSeats) },
    { key: 'totalSeats', label: 'Sức chứa', className: 'whitespace-nowrap text-right tabular-nums', render: row => formatReportCount(row.totalSeats) },
    { key: 'occupancyRate', label: 'Lấp đầy', className: 'whitespace-nowrap text-right tabular-nums', render: row => reportNumber(row.totalSeats) > 0 ? formatReportPercent(row.occupancyRate) : <span title="Chưa có sức chứa để tính tỷ lệ">—</span> },
    { key: 'capacitySource', label: 'Nguồn sức chứa', render: row => <span className={`inline-block min-w-32 text-xs leading-relaxed ${row.capacitySource === 'UNCONFIGURED' ? 'text-amber-300' : 'text-muted'}`}>{CAPACITY_SOURCES[row.capacitySource] || 'Chưa có thông tin nguồn'}</span> },
  ];

  return (
    <section aria-labelledby="admin-page-title" className="min-w-0" style={{ '--report-chart-bar': '#E50914', '--report-chart-grid': '#262635', '--report-chart-muted': '#9E9EA7', '--report-chart-text': '#E5E5E5', '--report-chart-cursor': '#ffffff08' }}>
      <header className="mb-7 border-l-4 border-primary pl-4">
        <h1 id="admin-page-title" className="font-display text-2xl font-bold text-white sm:text-3xl">Báo cáo quản trị</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">Doanh thu đã xác nhận và hiệu quả sử dụng phòng chiếu.</p>
      </header>
      <div className="mb-4 grid gap-3">
        {moviesQuery.isError && <AdminError title="Không thể tải danh mục phim" error={moviesQuery.error} onRetry={() => void moviesQuery.refetch()} retrying={moviesQuery.isFetching} />}
        {cinemasQuery.isError && <AdminError title="Không thể tải danh mục rạp" error={cinemasQuery.error} onRetry={() => void cinemasQuery.refetch()} retrying={cinemasQuery.isFetching} />}
        {(moviesQuery.isPending || cinemasQuery.isPending) && <p role="status" className="text-xs text-muted">Đang tải danh mục cho bộ lọc. Báo cáo vẫn được tải độc lập.</p>}
      </div>
      <ReportCatalogFilters filters={filters} moviesQuery={moviesQuery} cinemasQuery={cinemasQuery} onChange={changeFilters}
        onReset={() => { changeFilters(defaultReportFilters()); setResetVersion(previous => previous + 1); }} />

      <section id="admin-revenue-report" aria-labelledby="admin-revenue-title" className="min-w-0">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><h2 id="admin-revenue-title" className="font-display text-xl font-bold text-white">Doanh thu</h2>
            <p className="mt-2 text-xs text-muted">Theo ngày tạo đơn · {formatMovieDate(filters.startDate)} – {formatMovieDate(filters.endDate)}</p></div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-36"><AdminField label="Nhóm doanh thu">
              <select name="groupBy" value={filters.groupBy} onChange={event => changeFilters({ groupBy: event.target.value })}><option value="movie">Theo phim</option><option value="cinema">Theo rạp</option></select>
            </AdminField></div>
            <RefreshReport query={revenueQuery} label="Làm mới doanh thu" disabled={!validRange} />
          </div>
        </header>
        <RevenueDateFilters key={JSON.stringify([filters.startDate, filters.endDate, resetVersion])} filters={filters} onApply={changeFilters} />
        <p className="mb-5 max-w-3xl text-xs leading-relaxed text-muted">Chỉ đơn CONFIRMED (đã xác nhận), gồm tiền combo. Vé chỉ tính vị trí ghế BOOKED của các đơn này; ghế đang giữ không phải vé đã bán. Ngày tạo đơn khác với ngày chiếu và ngày thanh toán.</p>
        {!validRange ? <p role="alert" className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-sm text-red-300">Khoảng ngày chưa hợp lệ. Hãy chỉnh ngày rồi bấm Áp dụng ngày để tải doanh thu.</p> :
          <ReportQueryContent query={revenueQuery} title="Không thể tải doanh thu" loadingLabel="Đang tải doanh thu…">
            <dl className="grid min-w-0 gap-4 sm:grid-cols-3">
              <Metric id="admin-kpi-revenue" label="Doanh thu" value={formatReportMoney(revenue?.totalRevenue)} hint="Tổng tiền đơn xác nhận, gồm combo" icon={Banknote} emphasis />
              <Metric id="admin-kpi-bookings" label="Đơn xác nhận" value={formatReportCount(revenue?.totalSuccessfulBookings)} hint="Số đơn CONFIRMED trong khoảng ngày" icon={ClipboardCheck} />
              <Metric id="admin-kpi-tickets" label="Vé đã bán" value={formatReportCount(revenue?.totalTicketsSold)} hint="Tính theo từng vị trí ghế BOOKED" icon={Ticket} />
            </dl>
            {revenueRows.length ? <>
              <ReportRevenueChart rows={revenueRows} groupBy={filters.groupBy} />
              <h3 className="text-sm font-semibold text-white">Chi tiết theo nhóm</h3>
              <ReportDetailsTable key={JSON.stringify([commonParams, filters.startDate, filters.endDate, filters.groupBy])} columns={revenueColumns} rows={revenueRows} rowKey="id" caption="Chi tiết doanh thu" />
            </> : <AdminEmpty title="Chưa có nhóm doanh thu" description="Không có nhóm đơn xác nhận trong bộ lọc này. Hãy thử khoảng ngày, rạp hoặc phim khác." />}
          </ReportQueryContent>}
      </section>

      <section id="admin-occupancy-report" aria-labelledby="admin-occupancy-title" className="mt-10 min-w-0 border-t border-surfaceBorder pt-8">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><h2 id="admin-occupancy-title" className="font-display text-xl font-bold text-white">Tỷ lệ lấp đầy</h2>
            <p className="mt-2 text-xs text-muted">Theo ngày bắt đầu suất chiếu · gồm lịch sử và suất đã ngừng mở bán</p></div>
          <div className="flex min-w-0 flex-wrap items-end gap-3">
            <div className="min-w-0"><AdminField label="Ngày suất chiếu">
              <input name="occupancyDate" type="date" max="9999-12-31" value={filters.occupancyDate} onChange={event => { if (isCalendarDate(event.target.value)) changeFilters({ occupancyDate: event.target.value }); }} className="min-w-0 [color-scheme:dark]" />
            </AdminField></div>
            <RefreshReport query={occupancyQuery} label="Làm mới lấp đầy" />
          </div>
        </header>
        <ReportQueryContent query={occupancyQuery} title="Không thể tải tỷ lệ lấp đầy" loadingLabel="Đang tải tỷ lệ lấp đầy…">
          {missingCapacity > 0 && <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm leading-relaxed text-amber-200">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /><p><strong>{formatReportCount(missingCapacity)} suất thiếu cấu hình sức chứa.</strong> Tỷ lệ chỉ dựa trên phần sức chứa xác định; số liệu chưa đầy đủ.</p>
          </div>}
          <dl className="grid min-w-0 gap-4 sm:grid-cols-3">
            <Metric id="admin-kpi-occupancy" label="Tỷ lệ chung" value={capacity > 0 ? formatReportPercent(occupancy?.overallOccupancyRate) : '—'}
              hint={capacity > 0 ? missingCapacity ? 'Chưa đầy đủ do thiếu cấu hình sức chứa' : `${formatReportCount(occupancyRows.length)} suất trong ngày đã chọn` : 'Chưa có sức chứa để tính tỷ lệ'} emphasis />
            <Metric id="admin-kpi-booked-seats" label="Vị trí đã bán" value={formatReportCount(occupancy?.totalSeatsBooked)} hint="Chỉ BOOKED; không gồm ghế đang giữ" />
            <Metric id="admin-kpi-capacity" label="Tổng sức chứa" value={formatReportCount(occupancy?.totalSeatsAvailable)} hint="Gồm cả vị trí ghế đã bán" />
          </dl>
          <p className="text-xs leading-relaxed text-muted">Tỷ lệ chung = tổng vị trí BOOKED / tổng sức chứa × 100, không lấy trung bình tỷ lệ từng suất. Một cặp ghế gồm hai vị trí. Các ô “—” chưa có mẫu số để tính.</p>
          {occupancyRows.length ? <ReportDetailsTable key={JSON.stringify([commonParams, filters.occupancyDate])} columns={occupancyColumns} rows={occupancyRows} rowKey="showtimeId" caption="Chi tiết lấp đầy" /> :
            <AdminEmpty title="Không có suất chiếu trong bộ lọc này" description="Chọn ngày, rạp hoặc phim khác để xem tỷ lệ lấp đầy." />}
          <details className="rounded-xl border border-surfaceBorder bg-surface/30 p-4 text-xs leading-relaxed text-muted">
            <summary className="cursor-pointer rounded font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">Cách tính sức chứa</summary>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Ghế theo suất: giữ sức chứa đã sinh cho suất, kể cả khi cấu hình phòng đổi về sau.</li>
              <li>Ghế đang hoạt động: số ghế vật lý còn hoạt động khi suất chưa có ghế riêng.</li>
              <li>Sơ đồ hàng × cột: dùng cấu hình hợp lệ khi phòng chưa có ghế vật lý.</li>
              <li>Thiếu cấu hình: chưa có cơ sở xác định sức chứa. Phòng đã tắt mọi ghế có sức chứa bằng 0.</li>
            </ul>
            <p className="mt-3">Báo cáo chỉ đọc, không sinh ghế. Với cấu hình giữ nguyên, chỉ mở sơ đồ ghế không làm đổi sức chứa.</p>
          </details>
        </ReportQueryContent>
      </section>
    </section>
  );
}
