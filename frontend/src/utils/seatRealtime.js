/**
 * Ap dung 1 message WebSocket (SeatStatusUpdateMessage) len so do ghe dang cache
 * (ShowtimeSeatsMapResponse). Ham thuan khiet: khong sua object cu, tra ve cung
 * tham chieu neu khong co gi thay doi de React Query/React khong render lai thua.
 *
 * @param {{ seats: object[] } | undefined} seatMap
 * @param {{ seatIds: number[], status: string }} message
 */
export function applySeatStatusUpdate(seatMap, message) {
  if (!seatMap?.seats || !Array.isArray(message?.seatIds) || !message.status) return seatMap;

  const ids = new Set(message.seatIds);
  let changed = false;
  const seats = seatMap.seats.map((seat) => {
    if (!ids.has(seat.showtimeSeatId) || seat.status === message.status) return seat;
    // Ghe da ban khong bao gio doi sang trang thai khac (phong message den tre/sai thu tu)
    if (seat.status === 'BOOKED') return seat;
    changed = true;
    return { ...seat, status: message.status };
  });

  return changed ? { ...seatMap, seats } : seatMap;
}
