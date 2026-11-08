import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeatUnits, getSeatColumnCount, getSeatPlacement, groupSeatsByRow, toggleSeatSelection } from './seatHelper.js';

const available = id => ({ showtimeSeatId: id, status: 'AVAILABLE' });

test('orders rows and preserves missing column positions as aisles', () => {
  const rows = groupSeatsByRow([
    { rowChar: 'B', seatNumber: 2 }, { rowChar: 'AA', seatNumber: 1 },
    { rowChar: 'A', seatNumber: 3 }, { rowChar: 'A', seatNumber: 1 },
  ]);
  assert.deepEqual(rows.map(row => row.rowChar), ['A', 'B', 'AA']);
  assert.equal(rows[0].seatsByNumber.has(2), false);
  assert.equal(rows[0].seatsByNumber.get(3).seatNumber, 3);
  assert.deepEqual(groupSeatsByRow([]), []);
});

test('seat arcs are symmetric, tilt inward and become gentler in rear rows', () => {
  const left = getSeatPlacement(1, 5, 0, 10).transform;
  const right = getSeatPlacement(5, 5, 0, 10).transform;
  assert.equal(left, 'translateY(-18.0px) rotate(6.0deg)');
  assert.equal(right, 'translateY(-18.0px) rotate(-6.0deg)');
  assert.match(getSeatPlacement(3, 5, 0, 10).transform, /translateY\(0\.0px\)/);
  const rearY = Number(getSeatPlacement(1, 5, 9, 10).transform.match(/translateY\(([^p]+)/)[1]);
  assert.ok(Math.abs(rearY) < 18);
});

test('a one-column room has a valid centered placement', () => {
  assert.doesNotMatch(getSeatPlacement(1, 1, 0, 1).transform, /NaN|Infinity/);
  assert.match(getSeatPlacement(1, 1, 0, 1).transform, /translateY\(0\.0px\)/);
});

test('limits selection to eight, permits deselection at the limit and keeps prior sets immutable', () => {
  let ids = new Set();
  for (let id = 1; id <= 8; id++) ids = toggleSeatSelection(ids, available(id), 8).ids;
  const rejected = toggleSeatSelection(ids, available(9), 8);
  assert.equal(rejected.limitReached, true);
  assert.equal(rejected.ids.size, 8);
  const removed = toggleSeatSelection(ids, available(1), 8);
  assert.equal(removed.ids.size, 7);
  assert.equal(ids.size, 8);
  assert.equal(toggleSeatSelection(removed.ids, available(9), 8).ids.size, 8);
});

test('booked, locked and unknown states cannot be newly selected', () => {
  for (const status of ['BOOKED', 'LOCKED', 'UNKNOWN', undefined]) {
    const result = toggleSeatSelection(new Set(), { showtimeSeatId: 1, status }, 8);
    assert.equal(result.ids.size, 0);
    assert.equal(result.limitReached, false);
  }
});

const couplePosition = (column, status = 'AVAILABLE') => ({
  rowChar: 'J', seatNumber: column, showtimeSeatId: 200 + column,
  seatType: 'COUPLE', price: 120000, status,
});

function coupleUnits(positions, columns = 12) {
  return buildSeatUnits(new Map(positions.map(seat => [seat.seatNumber, seat])), columns);
}

test('twelve couple positions render as six two-column units with both original IDs and summed prices', () => {
  const positions = Array.from({ length: 12 }, (_, i) => couplePosition(i + 1));
  const units = coupleUnits(positions);
  assert.equal(units.length, 6);
  assert.equal(units.reduce((columns, unit) => columns + unit.span, 0), 12);
  assert.equal(units[0].label, 'J1–2');
  assert.deepEqual(units[0].seats.map(seat => seat.showtimeSeatId), [201, 202]);
  assert.equal(units[0].price, 240000);
});

test('one click selects or deselects both positions and a pair cannot exceed the eight-place limit', () => {
  const unit = coupleUnits([couplePosition(1), couplePosition(2)], 2)[0];
  const selected = toggleSeatSelection(new Set(), unit, 8);
  assert.deepEqual([...selected.ids], [201, 202]);
  assert.equal(toggleSeatSelection(selected.ids, unit, 8).ids.size, 0);
  const seven = new Set([1, 2, 3, 4, 5, 6, 7]);
  const rejected = toggleSeatSelection(seven, unit, 8);
  assert.equal(rejected.limitReached, true);
  assert.equal(rejected.ids.size, 7);
  assert.equal(toggleSeatSelection(new Set([1, 2, 3, 4, 5, 6]), unit, 8).ids.size, 8);
});

test('a booked or locked half disables selection of the whole couple unit', () => {
  for (const status of ['BOOKED', 'LOCKED']) {
    const unit = coupleUnits([couplePosition(1, status), couplePosition(2)], 2)[0];
    assert.equal(unit.status, status);
    assert.equal(toggleSeatSelection(new Set(), unit, 8).ids.size, 0);
  }
});

test('missing halves cannot join across an aisle or be sold alone', () => {
  const units = coupleUnits([couplePosition(1), couplePosition(4)], 4);
  assert.equal(units.length, 2);
  for (const unit of units) {
    assert.equal(unit.span, 2);
    assert.equal(unit.incomplete, true);
    assert.equal(toggleSeatSelection(new Set(), unit, 8).ids.size, 0);
  }
});

test('odd-width rooms reserve the complete final pair without inventing a bookable position', () => {
  const positions = [couplePosition(1), couplePosition(2), couplePosition(3)];
  const columns = getSeatColumnCount(positions, 3);
  assert.equal(columns, 4);
  const units = coupleUnits(positions, columns);
  assert.equal(units[1].span, 2);
  assert.equal(units[1].seats.length, 1);
  assert.equal(units[1].incomplete, true);
});
