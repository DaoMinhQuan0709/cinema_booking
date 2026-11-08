import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarX, MapPin, RefreshCw } from 'lucide-react';
import { useCinemas, useShowtimes } from './hooks/useShowtimes';
import { resolveShowtimeFilters } from './showtimeFilters';

const WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const DAYS_AHEAD = 7;
const EMPTY_LIST = [];
const PRICE_FORMATTER = new Intl.NumberFormat('vi-VN');

const pad = (n) => String(n).padStart(2, '0');

// Dung gio dia phuong, KHONG dung toISOString() (se lech ngay do UTC khi o VN)
function toLocalISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildDays(count) {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return {
      iso: toLocalISODate(d),
      weekday: i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : WEEKDAYS[d.getDay()],
      dayMonth: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
    };
  });
}

// startTime tu backend dang "2026-11-08T14:30:00" -> "14:30"
const formatTime = (startTime) => (startTime ? startTime.slice(11, 16) : '');

const formatPrice = (value) =>
  value == null ? null : `${PRICE_FORMATTER.format(value)}đ`;

const chipClass = (active) =>
  `cursor-pointer whitespace-nowrap rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-all ${
    active
      ? 'border-primary bg-primary/15 text-primary'
      : 'border-surfaceBorder bg-surface text-neutral-400 hover:border-neutral-500 hover:text-white'
  }`;

const SlotsSkeleton = () => (
  <div className="space-y-4">
    {[0, 1].map((i) => (
      <div key={i} className="animate-pulse rounded-xl border border-surfaceBorder bg-surface p-5">
        <div className="mb-4 h-4 w-1/3 rounded bg-background" />
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((j) => (
            <div key={j} className="h-14 w-24 rounded-lg bg-background" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

/**
 * Bo chon suat chieu tren trang chi tiet phim:
 * chon ngay (7 ngay toi) -> loc thanh pho / rap -> bam gio chieu de sang /booking/:showtimeId.
 *
 * Moi lan doi ngay se goi lai GET /showtimes?movieId=&date= (backend loc theo ngay),
 * thanh pho duoc tra cuu tu GET /cinemas vi ShowtimeResponse khong co city.
 *
 * @param {{ movieId: number|string }} props
 */
export const ShowtimeSelector = ({ movieId }) => {
  const navigate = useNavigate();
  const days = useMemo(() => buildDays(DAYS_AHEAD), []);

  const [selectedDate, setSelectedDate] = useState(days[0].iso);
  const [city, setCity] = useState('ALL');
  const [cinemaId, setCinemaId] = useState('ALL');

  const { data: showtimes = EMPTY_LIST, isLoading, isError, isSuccess, refetch, isFetching } = useShowtimes({
    movieId,
    date: selectedDate,
  });
  const { data: cinemas = EMPTY_LIST, isSuccess: hasCinemaData } = useCinemas();

  // cinemaId -> city (neu GET /cinemas loi thi map rong, bo loc thanh pho tu an)
  const cityByCinemaId = useMemo(() => {
    const map = new Map();
    cinemas.forEach((c) => map.set(c.id, c.city));
    return map;
  }, [cinemas]);

  // Gom suat chieu theo rap, sap xep gio tang dan
  const groups = useMemo(() => {
    const byCinema = new Map();
    showtimes.forEach((st) => {
      if (!byCinema.has(st.cinemaId)) {
        byCinema.set(st.cinemaId, {
          cinemaId: st.cinemaId,
          cinemaName: st.cinemaName,
          city: cityByCinemaId.get(st.cinemaId) ?? null,
          slots: [],
        });
      }
      byCinema.get(st.cinemaId).slots.push(st);
    });
    const list = Array.from(byCinema.values());
    list.forEach((g) => g.slots.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return list.sort((a, b) => a.cinemaName.localeCompare(b.cinemaName, 'vi'));
  }, [showtimes, cityByCinemaId]);

  const cities = useMemo(
    () => Array.from(new Set(groups.map((g) => g.city).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi')),
    [groups]
  );

  // Neu lua chon cu khong con ton tai o ngay moi -> tu quay ve "Tat ca"
  const { effectiveCity, effectiveCinemaId, cinemasInCity } = resolveShowtimeFilters(groups, city, cinemaId);

  // Persist a reset only after a successful response, not while a new date is loading.
  // The guarded update converges immediately and prevents an old selection reappearing later.
  if (isSuccess && hasCinemaData && city !== effectiveCity) setCity(effectiveCity);
  if (isSuccess && cinemaId !== effectiveCinemaId) setCinemaId(effectiveCinemaId);

  const visibleGroups = cinemasInCity.filter(
    (g) => effectiveCinemaId === 'ALL' || String(g.cinemaId) === String(effectiveCinemaId)
  );

  const handleSelectDate = (iso) => {
    setSelectedDate(iso);
  };

  const handleSelectCity = (value) => {
    setCity(value);
    setCinemaId('ALL');
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-white sm:text-2xl">Lịch Chiếu</h2>

      {/* Chon ngay */}
      <div className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-2">
        {days.map((day) => {
          const active = day.iso === selectedDate;
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => handleSelectDate(day.iso)}
              className={`flex min-w-[88px] shrink-0 cursor-pointer flex-col items-center rounded-xl border px-4 py-2.5 transition-all ${
                active
                  ? 'border-primary bg-primary text-white shadow-lg shadow-primary/25'
                  : 'border-surfaceBorder bg-surface text-neutral-300 hover:border-neutral-500'
              }`}
            >
              <span className="text-[11px] font-medium opacity-80">{day.weekday}</span>
              <span className="text-lg font-black leading-tight">{day.dayMonth}</span>
            </button>
          );
        })}
      </div>

      {/* Bo loc thanh pho / rap */}
      {groups.length > 0 && (cities.length > 0 || groups.length > 1) && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {cities.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => handleSelectCity('ALL')} className={chipClass(effectiveCity === 'ALL')}>
                Tất cả
              </button>
              {cities.map((c) => (
                <button key={c} type="button" onClick={() => handleSelectCity(c)} className={chipClass(effectiveCity === c)}>
                  {c}
                </button>
              ))}
            </div>
          )}

          {cinemasInCity.length > 1 && (
            <select
              value={effectiveCinemaId}
              onChange={(e) => setCinemaId(e.target.value)}
              aria-label="Lọc theo rạp"
              className="cursor-pointer rounded-lg border border-surfaceBorder bg-surface px-3 py-2 text-xs text-white focus:border-primary focus:outline-none"
            >
              <option value="ALL">Tất cả rạp</option>
              {cinemasInCity.map((g) => (
                <option key={g.cinemaId} value={g.cinemaId}>
                  {g.cinemaName}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Danh sach suat chieu */}
      <div className="mt-6">
        {isLoading ? (
          <SlotsSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-surfaceBorder py-12 text-center">
            <p className="text-sm text-muted">Không tải được lịch chiếu. Vui lòng thử lại.</p>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-primaryHover disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Thử lại
            </button>
          </div>
        ) : visibleGroups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-surfaceBorder py-12 text-center">
            <CalendarX className="h-8 w-8 text-muted" />
            <p className="max-w-xs text-sm text-muted">
              Chưa có suất chiếu nào trong ngày này. Hãy thử chọn ngày khác.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleGroups.map((group) => (
              <div key={group.cinemaId} className="rounded-xl border border-surfaceBorder bg-surface p-5">
                <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="text-sm font-bold text-white">{group.cinemaName}</h3>
                  {group.city && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <MapPin className="h-3 w-3" />
                      {group.city}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {group.slots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => navigate(`/booking/${slot.id}`)}
                      title={slot.auditoriumName}
                      className="group flex min-w-[92px] cursor-pointer flex-col items-center rounded-lg border border-surfaceBorder bg-background px-4 py-2 transition-all hover:border-primary hover:bg-primary/10 active:scale-95"
                    >
                      <span className="text-base font-bold text-white transition-colors group-hover:text-primary">
                        {formatTime(slot.startTime)}
                      </span>
                      <span className="max-w-[110px] truncate text-[10px] text-muted">
                        {formatPrice(slot.basePrice) ?? slot.auditoriumName}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShowtimeSelector;
