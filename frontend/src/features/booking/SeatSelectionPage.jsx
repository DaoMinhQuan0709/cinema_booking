import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Armchair, CalendarClock, MapPin, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { MAX_SEATS_PER_BOOKING, SEAT_STATUS } from '../../config/constants';
import { SeatLegend } from '../../components/common/SeatLegend';
import { useWebSocketSeatLock } from '../../hooks/useWebSocketSeatLock';
import { formatCurrency } from '../../utils/formatCurrency';
import { SEAT_TYPE_LABEL, buildSeatUnits, getSeatColumnCount, groupSeatsByRow, seatLabel, toggleSeatSelection } from '../../utils/seatHelper';
import { isInternalShowtimeId } from '../../utils/showtimeId';
import { SeatGrid } from './SeatGrid';
import { useShowtimeDetail, useShowtimeSeats } from './hooks/useShowtimeSeats';

const EMPTY_SEATS = [];

const BookingNotice = ({ title, message, onRetry, isFetching }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
    <Armchair aria-hidden="true" className="h-10 w-10 text-muted" />
    <h1 className="text-xl font-bold text-white">{title}</h1>
    <p className="max-w-md text-sm leading-relaxed text-muted">{message}</p>
    <div className="mt-2 flex flex-wrap justify-center gap-3">
      {onRetry && <button type="button" onClick={onRetry} disabled={isFetching} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-60"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />Thử lại</button>}
      <Link to="/movies" className="rounded-xl border border-surfaceBorder bg-surface px-5 py-2.5 text-sm font-semibold text-white hover:bg-surface/80">Chọn suất chiếu từ trang phim</Link>
    </div>
  </div>
);

// startTime tu backend dang "2026-11-08T14:30:00" -> "14:30 - 08/11/2026"
function formatShowtime(startTime) {
  if (!startTime) return '';
  const [date, time] = startTime.split('T');
  if (!time) return startTime;
  const [y, m, d] = date.split('-');
  return `${time.slice(0, 5)} - ${d}/${m}/${y}`;
}

const PageSkeleton = () => (
  <div className="mx-auto w-full max-w-[1200px] animate-pulse px-6 py-10 sm:px-10">
    <div className="mx-auto mb-10 h-16 w-2/3 rounded-xl bg-surface" />
    <div className="mx-auto h-72 w-full max-w-3xl rounded-xl bg-surface" />
  </div>
);

/**
 * Man hinh chon ghe (/booking/:showtimeId).
 * PHAN 1: ma tran ghe uon cong, chon/bo chon ghe (toi da 8 cho).
 * PHAN 2: WebSocket STOMP - ghe doi mau real-time khi nguoi khac giu/ban/nha ghe.
 * Cac phan tiep theo: POST /bookings giu ghe 10 phut, dong ho dem nguoc.
 */
const SeatSelection = ({ showtimeId }) => {
  const detailQuery = useShowtimeDetail(showtimeId);
  const seatsQuery = useShowtimeSeats(showtimeId);
  const { data: showtime } = detailQuery;
  const { data: seatMap } = seatsQuery;
  const seats = Array.isArray(seatMap?.seats) ? seatMap.seats : EMPTY_SEATS;
  const seatUnits = useMemo(() => {
    const columns = getSeatColumnCount(seats, seatMap?.totalCols);
    return groupSeatsByRow(seats).flatMap(row => buildSeatUnits(row.seatsByNumber, columns)).filter(unit => unit.seats.length);
  }, [seats, seatMap?.totalCols]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [previousUnits, setPreviousUnits] = useState(seatUnits);

  // A refreshed map can withdraw a selected seat. Do not reselect it if it later becomes free.
  if (previousUnits !== seatUnits) {
    setPreviousUnits(seatUnits);
    const availableIds = new Set(seatUnits.filter(unit => unit.status === SEAT_STATUS.AVAILABLE).flatMap(unit => unit.seats.map(seat => seat.showtimeSeatId)));
    setSelectedIds(previous => new Set([...previous].filter(id => availableIds.has(id))));
  }

  // Message WebSocket da duoc vá vao cache (seatsQuery.data) truoc khi callback nay chay;
  // o day chi bao cho nguoi dung biet neu ghe ho DANG CHON vua bi nguoi khac lay mat.
  const notifySeatTaken = (message) => {
    if (message.status === SEAT_STATUS.AVAILABLE) return;
    const taken = seats.filter(seat => selectedIds.has(seat.showtimeSeatId) && message.seatIds.includes(seat.showtimeSeatId));
    if (taken.length) {
      toast.warning(`Ghế ${taken.map(seatLabel).join(', ')} vừa có người khác chọn. Vui lòng chọn ghế khác.`, { id: 'seat-taken' });
    }
  };
  const { isConnected } = useWebSocketSeatLock(showtimeId, { onSeatUpdate: notifySeatTaken });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const selectedUnits = useMemo(
    () => seatUnits.filter(unit => unit.status === SEAT_STATUS.AVAILABLE && unit.seats.every(seat => selectedIds.has(seat.showtimeSeatId))),
    [seatUnits, selectedIds]
  );
  const selectedCount = selectedUnits.reduce((count, unit) => count + unit.seats.length, 0);
  const total = selectedUnits.reduce((sum, unit) => sum + unit.price, 0);

  const handleToggle = useCallback((seat) => {
    const result = toggleSeatSelection(selectedIds, seat, MAX_SEATS_PER_BOOKING);
    if (result.limitReached) {
      toast.warning(`Bạn chỉ được chọn tối đa ${MAX_SEATS_PER_BOOKING} chỗ mỗi lần đặt.`, { id: 'seat-selection-limit' });
      return;
    }
    setSelectedIds(result.ids);
  }, [selectedIds]);

  const isFetching = seatsQuery.isFetching || detailQuery.isFetching;
  const refresh = () => Promise.allSettled([seatsQuery.refetch(), detailQuery.refetch()]);
  if (seatsQuery.isLoading || detailQuery.isLoading) return <PageSkeleton />;

  if (!seatMap || !showtime) {
    const error = seatsQuery.error ?? detailQuery.error;
    const status = error?.response?.status;
    return <BookingNotice
      title={status === 404 ? 'Không tìm thấy suất chiếu' : 'Không tải được sơ đồ ghế'}
      message={error?.response?.data?.message ?? 'Suất chiếu có thể đã ngừng bán hoặc kết nối đang gián đoạn.'}
      onRetry={!status || status >= 500 ? refresh : undefined}
      isFetching={isFetching}
    />;
  }

  if (!seats.length) return <BookingNotice title="Chưa có sơ đồ ghế" message="Phòng chiếu chưa có ghế khả dụng để hiển thị. Vui lòng chọn suất khác hoặc thử lại sau." onRetry={refresh} isFetching={isFetching} />;

  return (
    <div className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 pt-8 sm:px-8 lg:px-12">
      <Link
        to={showtime.movieId ? `/movies/${showtime.movieId}` : '/movies'}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Chọn suất khác
      </Link>

      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-white">Chọn ghế của bạn</h1><p className="mt-2 text-sm text-muted">Chọn tối đa {MAX_SEATS_PER_BOOKING} chỗ. Ghế đôi chiếm 2 chỗ. Vuốt ngang để xem trọn sơ đồ.</p></div>
        <div className="flex items-center gap-4">
          <span role="status" className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'animate-pulse bg-neutral-600'}`} />
            {isConnected ? 'Cập nhật trực tiếp' : 'Đang kết nối…'}
          </span>
          <button type="button" onClick={refresh} disabled={isFetching} className="inline-flex items-center gap-2 rounded-lg border border-surfaceBorder px-3 py-2 text-sm text-neutral-300 hover:text-white disabled:opacity-50"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />Làm mới</button>
        </div>
      </div>
      {(seatsQuery.isError || detailQuery.isError) && <p role="alert" className="mb-5 rounded-lg border border-primary/30 p-3 text-sm text-neutral-300">Chưa làm mới được dữ liệu. Vui lòng kiểm tra kết nối và thử lại.</p>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Khu vuc so do ghe */}
        <section className="min-w-0 rounded-2xl border border-surfaceBorder bg-surface/40 px-2 py-8 sm:px-6">
          <div>
            <SeatGrid
              seats={seats}
              totalCols={seatMap.totalCols}
              selectedIds={selectedIds}
              onToggle={handleToggle}
            />
          </div>
          <div className="mt-6 border-t border-surfaceBorder pt-5">
            <SeatLegend />
          </div>
        </section>

        {/* Cot phai: thong tin suat chieu va ghe dang chon (dong ho + nut Tiep tuc se bo sung o phan sau) */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-surfaceBorder bg-surface p-5">
            {showtime && (
              <div className="border-b border-surfaceBorder pb-4">
                <h2 className="text-lg font-black leading-snug text-white">{showtime.movieTitle}</h2>
                <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {showtime.cinemaName} - {showtime.auditoriumName}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  {formatShowtime(showtime.startTime)}
                </p>
              </div>
            )}

            <div className="pt-4">
              {selectedCount > 0 && <button type="button" onClick={() => setSelectedIds(new Set())} className="mb-3 rounded text-xs text-muted hover:text-white">Bỏ chọn tất cả</button>}
              <h2 className="text-sm font-semibold text-white">
                Chỗ đã chọn ({selectedCount}/{MAX_SEATS_PER_BOOKING})
              </h2>
              {selectedCount === 0 ? (
                <p className="mt-2 text-xs text-muted">Chưa chọn ghế nào. Hãy bấm vào ghế trống trên sơ đồ.</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {selectedUnits.map((unit) => (
                    <li key={unit.seats[0].showtimeSeatId} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-200">
                        <strong className="text-white">{unit.label}</strong>{' '}
                        <span className="text-xs text-muted">
                          {SEAT_TYPE_LABEL[unit.seatType] ?? unit.seatType}{unit.span === 2 ? ' · 2 chỗ' : ''}
                        </span>
                      </span>
                      <span className="text-neutral-300">{formatCurrency(unit.price)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-surfaceBorder pt-4">
                <span className="text-sm text-muted">Tạm tính</span>
                <span className="text-lg font-black text-primary">{formatCurrency(total)}</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">Việc chọn ghế ở đây chưa thực hiện giữ chỗ.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export const SeatSelectionPage = () => {
  const { showtimeId } = useParams();
  if (!isInternalShowtimeId(showtimeId)) return <BookingNotice title="Liên kết suất chiếu không hợp lệ" message="Vui lòng mở trang chi tiết phim và chọn giờ chiếu để đến sơ đồ ghế." />;
  return <SeatSelection key={showtimeId} showtimeId={showtimeId} />;
};

export default SeatSelectionPage;
