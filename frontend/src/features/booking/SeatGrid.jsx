import { memo, useMemo } from 'react';
import { Lock } from 'lucide-react';
import { SEAT_STATUS } from '../../config/constants';
import { SEAT_TYPE_LABEL, buildSeatUnits, getSeatColumnCount, getSeatPlacement, groupSeatsByRow } from '../../utils/seatHelper';
import { CurvedScreen } from '../../components/common/CurvedScreen';

const TYPE_CLASS = {
  STANDARD: 'bg-seat-standard text-neutral-200 hover:bg-neutral-500',
  VIP: 'bg-seat-vip text-black/80 hover:brightness-110',
  COUPLE: 'bg-seat-couple text-white hover:brightness-110',
};

function seatClass(seat, isSelected) {
  const base =
    'relative flex h-7 w-full items-center justify-center gap-1 rounded-t-lg rounded-b-sm text-[10px] font-semibold transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none sm:h-8 sm:text-[11px]';

  if (seat.status === SEAT_STATUS.BOOKED) {
    return `${base} cursor-not-allowed border border-surfaceBorder bg-seat-booked text-neutral-600`;
  }
  if (seat.status === SEAT_STATUS.LOCKED) {
    return `${base} cursor-not-allowed bg-seat-locked/70 text-white/90`;
  }
  if (isSelected) {
    return `${base} z-10 cursor-pointer bg-seat-selected text-white shadow-[0_0_12px_rgba(229,9,20,0.75)]`;
  }
  if (seat.incomplete) return `${base} cursor-not-allowed border border-surfaceBorder bg-seat-booked text-neutral-600`;
  return `${base} cursor-pointer ${TYPE_CLASS[seat.seatType] ?? TYPE_CLASS.STANDARD}`;
}

function seatTitle(seat) {
  const type = SEAT_TYPE_LABEL[seat.seatType] ?? seat.seatType;
  const label = `${seat.label} - ${type}${seat.span === 2 ? ' (2 chỗ)' : ''}`;
  if (seat.status === SEAT_STATUS.BOOKED) return `${label} (đã bán)`;
  if (seat.status === SEAT_STATUS.LOCKED) return `${label} (đang có người giữ)`;
  if (seat.incomplete) return `${label} (chưa đủ cặp)`;
  return label;
}

const Seat = memo(function Seat({ seat, isSelected, onToggle, style }) {
  const unavailable = seat.status !== SEAT_STATUS.AVAILABLE;
  return (
    <button
      type="button"
      disabled={unavailable}
      aria-pressed={isSelected}
      aria-label={seatTitle(seat)}
      title={seatTitle(seat)}
      onClick={() => onToggle(seat)}
      style={style}
      className={seatClass(seat, isSelected)}
    >
      {seat.status === SEAT_STATUS.LOCKED ? <Lock aria-hidden="true" className="h-3 w-3" /> : seat.numberLabel}
    </button>
  );
});

/**
 * Ma tran ghe uon cong quanh man hinh.
 * Moi ghe duoc dich len (translateY) va nghieng nhe theo vi tri cot: ghe o mep
 * cao hon va huong vao giua, tao cac hang cong dong tam voi man hinh.
 * Hang gan man hinh cong nhieu, hang xa man hinh thang dan.
 *
 * @param {Object} props
 * @param {object[]} props.seats ShowtimeSeatResponse[] tu GET /showtimes/{id}/seats
 * @param {number} props.totalCols so cot cua phong chieu
 * @param {Set<number>} props.selectedIds tap showtimeSeatId dang duoc chon
 * @param {(seat: object) => void} props.onToggle
 */
export const SeatGrid = ({ seats = [], totalCols, selectedIds, onToggle }) => {
  const rows = useMemo(() => groupSeatsByRow(seats), [seats]);

  const cols = useMemo(() => getSeatColumnCount(seats, totalCols), [seats, totalCols]);

  const layout = useMemo(() => rows.map(({ rowChar, seatsByNumber }, rowIndex) => ({
    rowChar,
    leftLabelStyle: getSeatPlacement(1, cols, rowIndex, rows.length),
    rightLabelStyle: getSeatPlacement(cols, cols, rowIndex, rows.length),
    cells: buildSeatUnits(seatsByNumber, cols).map(unit => ({
      ...unit,
      style: { ...getSeatPlacement(unit.column + (unit.span - 1) / 2, cols, rowIndex, rows.length),
        gridColumn: `${unit.column + 1} / span ${unit.span}` },
    })),
  })), [rows, cols]);

  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto overscroll-x-contain pb-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" role="group" aria-label="Sơ đồ ghế, có thể cuộn ngang" tabIndex={0}>
      <div className="mx-auto w-max min-w-full px-3">
        <CurvedScreen />
        <div className="mx-auto flex w-max flex-col gap-2 px-4 pt-6 sm:gap-2.5">
          {layout.map(({ rowChar, cells, leftLabelStyle, rightLabelStyle }) => {
            const label = (style) => (
              <span
                aria-hidden="true"
                style={style}
                className="flex h-7 w-6 items-center justify-center text-xs font-bold text-neutral-500 sm:h-8 sm:w-7"
              >
                {rowChar}
              </span>
            );

            return (
              <div key={rowChar} style={{ gridTemplateColumns: `var(--row-label) repeat(${cols}, var(--seat-size)) var(--row-label)` }} className="grid items-center gap-1.5 [--row-label:24px] [--seat-size:28px] sm:gap-2 sm:[--row-label:28px] sm:[--seat-size:32px]">
                {label(leftLabelStyle)}
                {cells.map(unit => {
                  const { column, seats: members, style } = unit;
                  // O trong (ghe khong hoat dong / loi di) giu nguyen vi tri de khong lech hang
                  if (!members.length) {
                    return <span key={column} aria-hidden="true" style={{ gridColumn: column + 1 }} className="h-7 sm:h-8" />;
                  }
                  return (
                    <Seat
                      key={column}
                      seat={unit}
                      isSelected={members.every(member => selectedIds.has(member.showtimeSeatId))}
                      onToggle={onToggle}
                      style={style}
                    />
                  );
                })}
                {label(rightLabelStyle)}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
};

export default SeatGrid;
