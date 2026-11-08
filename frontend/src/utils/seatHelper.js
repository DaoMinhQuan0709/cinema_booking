export const SEAT_TYPE_LABEL = {
  STANDARD: 'Thường',
  VIP: 'VIP',
  COUPLE: 'Đôi',
};

/** Nhan ghe hien thi, vd: "F5". */
export const seatLabel = (seat) => `${seat.rowChar}${seat.seatNumber}`;

/**
 * Gom danh sach ghe phang tu API thanh cac hang, sap xep theo ky tu hang.
 * @param {object[]} seats ShowtimeSeatResponse[]
 * @returns {{ rowChar: string, seatsByNumber: Map<number, object> }[]}
 */
export function groupSeatsByRow(seats = []) {
  const rows = new Map();
  seats.forEach((seat) => {
    if (!rows.has(seat.rowChar)) rows.set(seat.rowChar, new Map());
    rows.get(seat.rowChar).set(seat.seatNumber, seat);
  });
  return Array.from(rows.entries())
    .sort(([a], [b]) => a.length - b.length || a.localeCompare(b))
    .map(([rowChar, seatsByNumber]) => ({ rowChar, seatsByNumber }));
}

/** Preserve physical columns while presenting paired couple positions as a single unit. */
export function getSeatColumnCount(seats, totalCols) {
  const columns = Math.max(totalCols || 0, seats.reduce((max, seat) => Math.max(max, seat.seatNumber), 0));
  return seats.some(seat => seat.seatType === 'COUPLE') && columns % 2 ? columns + 1 : columns;
}

export function buildSeatUnits(seatsByNumber, columns) {
  const units = [];
  for (let column = 1; column <= columns; column++) {
    const seat = seatsByNumber.get(column);
    const next = seatsByNumber.get(column + 1);
    const couplePair = column % 2 === 1 && (seat?.seatType === 'COUPLE' || next?.seatType === 'COUPLE')
      && (!seat || seat.seatType === 'COUPLE') && (!next || next.seatType === 'COUPLE');
    if (couplePair) {
      const members = [seat, next].filter(Boolean);
      units.push({
        column, span: 2, seats: members, seatType: 'COUPLE',
        label: `${members[0].rowChar}${column}–${column + 1}`,
        numberLabel: `${column}–${column + 1}`,
        incomplete: members.length !== 2,
        price: members.reduce((total, member) => total + Number(member.price ?? 0), 0),
        status: getUnitStatus(members, members.length !== 2),
      });
      column++;
    } else {
      units.push({ column, span: 1, seats: seat ? [seat] : [],
        seatType: seat?.seatType, label: seat ? seatLabel(seat) : '', numberLabel: seat?.seatNumber,
        incomplete: seat?.seatType === 'COUPLE', price: Number(seat?.price ?? 0),
        status: seat?.seatType === 'COUPLE' ? 'INCOMPLETE' : seat?.status });
    }
  }
  return units;
}

function getUnitStatus(seats, incomplete) {
  if (seats.some(seat => seat.status === 'BOOKED')) return 'BOOKED';
  if (seats.some(seat => seat.status === 'LOCKED')) return 'LOCKED';
  if (incomplete || seats.some(seat => seat.status !== 'AVAILABLE')) return 'INCOMPLETE';
  return 'AVAILABLE';
}

/** Symmetric arc: edges rise toward the screen, with a gentler curve in rear rows. */
export function getSeatPlacement(column, columns, rowIndex, rowCount) {
  const position = columns > 1 ? ((column - 1) / (columns - 1)) * 2 - 1 : 0;
  const curve = 18 * Math.max(0, 1 - rowIndex / (Math.max(rowCount, 1) * 1.6));
  return {
    transform: `translateY(${(-curve * position * position).toFixed(1)}px) rotate(${(-position * 6).toFixed(1)}deg)`,
  };
}

/** Pure selection transition; notifications belong in the click handler, not React's state updater. */
export function toggleSeatSelection(selectedIds, seat, limit) {
  const members = seat.seats ?? [seat];
  const memberIds = members.map(member => member.showtimeSeatId);
  if (!memberIds.length) return { ids: selectedIds, limitReached: false };
  if (memberIds.every(id => selectedIds.has(id))) {
    const ids = new Set(selectedIds);
    memberIds.forEach(id => ids.delete(id));
    return { ids, limitReached: false };
  }
  if (seat.incomplete || members.some(member => member.status !== 'AVAILABLE')) return { ids: selectedIds, limitReached: false };
  const added = memberIds.filter(id => !selectedIds.has(id)).length;
  if (selectedIds.size + added > limit) return { ids: selectedIds, limitReached: true };
  return { ids: new Set([...selectedIds, ...memberIds]), limitReached: false };
}
