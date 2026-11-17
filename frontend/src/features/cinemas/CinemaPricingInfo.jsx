import { TicketPercent } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';
import { getCinemaPriceRows } from './cinemaDetailInfoUtils';

const CinemaPricingInfo = ({ movies, dateLabel, isLoading, isError }) => {
  const rows = getCinemaPriceRows(movies);

  return (
    <section aria-labelledby="cinema-pricing-title" className="min-w-0 rounded-2xl border border-surfaceBorder bg-surface/60 p-5 sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        <TicketPercent aria-hidden="true" className="h-6 w-6 shrink-0 text-primary" />
        <h2 id="cinema-pricing-title" className="font-display text-xl font-bold text-white sm:text-2xl">Giá vé tại rạp</h2>
      </div>
      <p className="text-sm leading-relaxed text-muted">Giá cơ bản của các suất còn mở bán {dateLabel}. Giá cuối được tính khi chọn ghế và xác nhận đơn.</p>

      {rows.length ? (
        <ul className="mt-6 divide-y divide-surfaceBorder border-y border-surfaceBorder">
          {rows.map(row => (
            <li key={row.movieId} className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 py-4 text-sm">
              <span className="min-w-0 break-words text-white">{row.title}</span>
              <span className="shrink-0 font-semibold tabular-nums text-primary">
                {formatCurrency(row.min)}{row.max > row.min ? ` – ${formatCurrency(row.max)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p role="status" className="mt-6 rounded-xl border border-dashed border-surfaceBorder px-4 py-5 text-sm text-muted">
          {isLoading ? 'Đang tải giá cơ bản…' : isError ? 'Chưa tải được giá cơ bản. Hãy thử lại ở phần lịch chiếu.' : 'Chưa có giá cơ bản cho các suất còn mở bán trong ngày này.'}
        </p>
      )}
      {isError && rows.length > 0 && <p className="mt-4 text-xs leading-relaxed text-muted">Giá đang hiển thị từ dữ liệu đã tải trước đó.</p>}
    </section>
  );
};

export default CinemaPricingInfo;
