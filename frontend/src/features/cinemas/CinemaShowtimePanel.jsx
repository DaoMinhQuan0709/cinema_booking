import { Link } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';
import { isInternalShowtimeId } from '../../utils/showtimeId';

const FOCUS_CLASS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';

/**
 * Giờ chiếu của phim đã chọn tại rạp đang xem. Mỗi suất dẫn tới /booking/:showtimeId bằng ID nội bộ;
 * suất có ID không hợp lệ bị bỏ để không tạo liên kết sai. Danh sách đã được lọc suất đã bắt đầu
 * ở CinemaDetailSelection (tính lại mỗi phút theo giờ Việt Nam).
 *
 * @param {{ movie: { movieId: string, title: string, showtimes: { id: number|string, startTime: string,
 *           auditoriumName?: string, basePrice?: number|null }[] } }} props
 */
const CinemaShowtimePanel = ({ movie }) => {
  const slots = movie.showtimes.filter(slot => isInternalShowtimeId(slot.id));

  return (
    <section aria-labelledby="cinema-showtime-title" className="mt-2">
      <div className="mb-5 flex items-center gap-3">
        <Ticket aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
        <h3 id="cinema-showtime-title" className="min-w-0 break-words font-display text-xl font-bold text-white">Suất chiếu: {movie.title}</h3>
      </div>
      {slots.length ? (
        <ul className="flex flex-wrap gap-3">
          {slots.map(slot => {
            const time = slot.startTime.slice(11, 16);
            return (
              <li key={slot.id}>
                <Link
                  to={`/booking/${slot.id}`}
                  title={slot.auditoriumName}
                  aria-label={`${time}${slot.auditoriumName ? `, ${slot.auditoriumName}` : ''}`}
                  className={`group flex min-h-11 min-w-[104px] flex-col items-center justify-center gap-1 rounded-lg border border-surfaceBorder bg-background px-4 py-3 transition-colors hover:border-primary hover:bg-primary/10 ${FOCUS_CLASS}`}
                >
                  <time dateTime={slot.startTime} className="text-lg font-bold tabular-nums text-white transition-colors group-hover:text-primary">{time}</time>
                  {slot.auditoriumName && <span className="max-w-[140px] truncate text-[11px] text-neutral-300">{slot.auditoriumName}</span>}
                  <span className="text-[11px] text-muted">{slot.basePrice == null ? 'Xem giá vé' : `từ ${formatCurrency(slot.basePrice)}`}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p role="status" className="text-sm text-muted">Phim này hiện không còn suất chiếu mở bán tại rạp trong ngày đã chọn.</p>
      )}
    </section>
  );
};

export default CinemaShowtimePanel;
