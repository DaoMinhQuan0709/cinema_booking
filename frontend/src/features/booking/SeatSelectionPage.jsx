import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Armchair, CalendarClock, CheckCircle2, MapPin, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { MAX_SEATS_PER_BOOKING, SEAT_STATUS } from '../../config/constants';
import { SeatLegend } from '../../components/common/SeatLegend';
import { useWebSocketSeatLock } from '../../hooks/useWebSocketSeatLock';
import { formatCurrency } from '../../utils/formatCurrency';
import { SEAT_TYPE_LABEL, buildSeatUnits, getSeatColumnCount, groupSeatsByRow, seatLabel, toggleSeatSelection } from '../../utils/seatHelper';
import { isInternalShowtimeId } from '../../utils/showtimeId';
import { SeatGrid } from './SeatGrid';
import { useShowtimeDetail, useShowtimeSeats } from './hooks/useShowtimeSeats';
import { useBookingHold } from './hooks/useBookingHold';
import { formatHoldExpiry } from './bookingHold';

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
 * PHAN 3: POST /bookings giu ghe 10 phut, xu ly 409 va xac nhan giu cho.
 * Dem nguoc/checkout/thanh toan se duoc tich hop o phan sau.
 */
const SeatSelection = ({ showtimeId }) => {
  const navigate = useNavigate();
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
  const { booking, isCreating, isCancelling, isRestoring, restoreError, retryRestore, submittedIds, holdSeats, cancelHold, isOwnHoldSeat, handleSeatUpdate } = useBookingHold(showtimeId);
  const isSubmitting = isCreating || isCancelling || isRestoring;
  const selectionDisabled = isSubmitting || restoreError || Boolean(booking);
  const heldIds = useMemo(() => new Set(booking?.seats.map(seat => seat.showtimeSeatId) ?? []), [booking]);

  // A refreshed map can withdraw a selected seat. Do not reselect it if it later becomes free.
  if (previousUnits !== seatUnits) {
    setPreviousUnits(seatUnits);
    const availableIds = new Set(seatUnits.filter(unit => unit.status === SEAT_STATUS.AVAILABLE).flatMap(unit => unit.seats.map(seat => seat.showtimeSeatId)));
    setSelectedIds(previous => new Set([...previous].filter(id => availableIds.has(id))));
  }

  // Message WebSocket da duoc vá vao cache (seatsQuery.data) truoc khi callback nay chay;
  // o day chi bao cho nguoi dung biet neu ghe ho DANG CHON vua bi nguoi khac lay mat.
  const notifySeatTaken = (message) => {
    handleSeatUpdate(message);
    if (message.status === SEAT_STATUS.AVAILABLE) return;
    const taken = seats.filter(seat => selectedIds.has(seat.showtimeSeatId)
      && message.seatIds.includes(seat.showtimeSeatId) && !isOwnHoldSeat(seat.showtimeSeatId));
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
  const summaryUnits = useMemo(() => {
    if (!booking && !isCreating) return selectedUnits;
    const ids = booking ? heldIds : new Set(submittedIds);
    const prices = new Map(booking?.seats.map(seat => [seat.showtimeSeatId, seat.price]) ?? []);
    return seatUnits.filter(unit => unit.seats.every(seat => ids.has(seat.showtimeSeatId)))
      .map(unit => ({ ...unit, price: unit.seats.reduce((sum, seat) => sum + Number(prices.get(seat.showtimeSeatId) ?? seat.price), 0) }));
  }, [booking, isCreating, selectedUnits, heldIds, submittedIds, seatUnits]);
  const selectedCount = summaryUnits.reduce((count, unit) => count + unit.seats.length, 0);
  const total = booking?.totalAmount ?? summaryUnits.reduce((sum, unit) => sum + unit.price, 0);

  const handleToggle = useCallback((seat) => {
    if (selectionDisabled) return;
    const result = toggleSeatSelection(selectedIds, seat, MAX_SEATS_PER_BOOKING);
    if (result.limitReached) {
      toast.warning(`Bạn chỉ được chọn tối đa ${MAX_SEATS_PER_BOOKING} chỗ mỗi lần đặt.`, { id: 'seat-selection-limit' });
      return;
    }
    setSelectedIds(result.ids);
  }, [selectedIds, selectionDisabled]);

  async function handleContinue() {
    const held = await holdSeats(showtime.id, selectedUnits);
    if (held) {
      setSelectedIds(new Set());
      navigate(`/checkout/${encodeURIComponent(held.bookingCode)}`);
    }
  }

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
          <button type="button" onClick={refresh} disabled={isFetching || isSubmitting} className="inline-flex items-center gap-2 rounded-lg border border-surfaceBorder px-3 py-2 text-sm text-neutral-300 hover:text-white disabled:opacity-50"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />Làm mới</button>
        </div>
      </div>
      {(seatsQuery.isError || detailQuery.isError) && <p role="alert" className="mb-5 rounded-lg border border-primary/30 p-3 text-sm text-neutral-300">Chưa làm mới được dữ liệu. Vui lòng kiểm tra kết nối và thử lại.</p>}
      {restoreError && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 p-4 text-sm text-neutral-300"><p>Chưa kiểm tra được đơn giữ ghế trước đó. Vui lòng thử lại trước khi đặt tiếp.</p><button type="button" onClick={retryRestore} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primaryHover">Thử lại thông tin giữ chỗ</button></div>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Khu vuc so do ghe */}
        <section className="min-w-0 rounded-2xl border border-surfaceBorder bg-surface/40 px-2 py-8 sm:px-6">
          <div>
            <SeatGrid
              seats={seats}
              totalCols={seatMap.totalCols}
              selectedIds={selectedIds}
              heldIds={heldIds}
              disabled={selectionDisabled}
              onToggle={handleToggle}
            />
          </div>
          <div className="mt-6 border-t border-surfaceBorder pt-5">
            <SeatLegend hasOwnHold={Boolean(booking)} />
          </div>
        </section>

        {/* Thong tin suat chieu, tam tinh va ket qua giu ghe */}
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
              {selectedCount > 0 && !booking && <button type="button" onClick={() => setSelectedIds(new Set())} disabled={isSubmitting} className="mb-3 rounded text-xs text-muted hover:text-white disabled:opacity-50">Bỏ chọn tất cả</button>}
              <h2 className="text-sm font-semibold text-white">
                {booking ? 'Chỗ đang giữ' : 'Chỗ đã chọn'} ({selectedCount}/{MAX_SEATS_PER_BOOKING})
              </h2>
              {selectedCount === 0 ? (
                <p className="mt-2 text-xs text-muted">Chưa chọn ghế nào. Hãy bấm vào ghế trống trên sơ đồ.</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {summaryUnits.map((unit) => (
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
                <span className="text-sm text-muted">{booking ? 'Tổng tiền vé' : 'Tạm tính'}</span>
                <span className="text-lg font-black text-primary">{formatCurrency(total)}</span>
              </div>
              <button
                type="button"
                onClick={handleContinue}
                disabled={!selectedCount || selectionDisabled || isFetching}
                aria-busy={isCreating || isRestoring}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-surfaceBorder disabled:text-muted"
              >
                {isRestoring || isCreating ? <><RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />{isRestoring ? 'Đang kiểm tra giữ chỗ…' : 'Đang giữ ghế…'}</> : booking ? <><CheckCircle2 aria-hidden="true" className="h-4 w-4" />Đã giữ ghế</> : <>Tiếp tục<ArrowRight aria-hidden="true" className="h-4 w-4" /></>}
              </button>
              {booking ? (
                <div role="status" className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-white">Ghế đang được giữ cho bạn</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted">Mã đặt chỗ: <strong className="break-all font-mono text-white">{booking.bookingCode}</strong></p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">Hạn giữ: <time dateTime={booking.expiresAt} className="font-medium text-white">{formatHoldExpiry(booking.expiresAt)}</time></p>
                  <Link to={`/checkout/${encodeURIComponent(booking.bookingCode)}`} className="mt-3 flex min-h-11 items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primaryHover">Tiếp tục thanh toán</Link>
                  <button type="button" onClick={cancelHold} disabled={isSubmitting} className="mt-3 min-h-10 w-full rounded-lg border border-surfaceBorder px-3 py-2 text-xs font-semibold text-neutral-300 hover:border-neutral-500 hover:text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{isCancelling ? 'Đang hủy giữ ghế…' : 'Hủy giữ ghế để chọn lại'}</button>
                </div>
              ) : <p className="mt-3 text-xs leading-relaxed text-muted">Bấm “Tiếp tục” để giữ các ghế đã chọn trong 10 phút. Bạn cần đăng nhập để giữ chỗ.</p>}
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
