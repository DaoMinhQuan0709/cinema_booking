import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultReportFilters, readReportFilters, writeReportFilters, validateRevenueRange, formatReportMoney, formatReportCount, formatReportPercent, selectRevenueChartRows, reportNumber } from './reportUtils.js';

test('report defaults use Vietnam calendar month and an independent occupancy date', () => {
  const filters = defaultReportFilters(new Date('2026-10-31T18:00:00Z'));
  assert.deepEqual(filters, { startDate: '2026-11-01', endDate: '2026-11-01', cinemaId: '', movieId: '', groupBy: 'movie', occupancyDate: '2026-11-01' });
});

test('URL parsing normalizes malformed dates, IDs and grouping without swapping a reversed valid range', () => {
  const now = new Date('2026-11-12T10:00:00Z');
  const invalid = readReportFilters(new URLSearchParams('startDate=2026-02-30&endDate=bad&movieId=1e3&cinemaId=-1&groupBy=none&occupancyDate=0000-01-01'), now);
  assert.deepEqual(invalid, defaultReportFilters(now));
  const reversed = readReportFilters(new URLSearchParams('startDate=2026-11-12&endDate=2026-11-01&cinemaId=2&movieId=3&groupBy=cinema&occupancyDate=2020-01-01'), now);
  assert.equal(reversed.startDate, '2026-11-12'); assert.equal(reversed.endDate, '2026-11-01');
  assert.ok(validateRevenueRange(reversed).endDate); assert.equal(reversed.occupancyDate, '2020-01-01');
  assert.equal(reversed.groupBy, 'cinema'); assert.equal(reversed.cinemaId, '2'); assert.equal(reversed.movieId, '3');
});

test('URL writes keep unrelated params and preserve independent dates when changing a common filter', () => {
  const filters = defaultReportFilters(new Date('2026-11-12T10:00:00Z'));
  const params = writeReportFilters(new URLSearchParams('source=test&cinemaId=9'), { ...filters, movieId: '3', occupancyDate: '2026-11-10' });
  assert.equal(params.get('source'), 'test'); assert.equal(params.has('cinemaId'), false);
  const changed = readReportFilters(params);
  assert.equal(changed.startDate, '2026-11-01'); assert.equal(changed.endDate, '2026-11-12');
  assert.equal(changed.occupancyDate, '2026-11-10'); assert.equal(changed.movieId, '3');
});

test('date validation accepts inclusive one-day/leap-day ranges and rejects missing or reversed inputs', () => {
  assert.deepEqual(validateRevenueRange({ startDate: '2028-02-29', endDate: '2028-02-29' }), {});
  assert.ok(validateRevenueRange({ startDate: '', endDate: '2026-11-12' }).startDate);
  assert.ok(validateRevenueRange({ startDate: '2026-02-29', endDate: '2026-11-12' }).startDate);
  assert.ok(validateRevenueRange({ startDate: '2026-11-12', endDate: '' }).endDate);
  assert.ok(validateRevenueRange({ startDate: '2026-11-12', endDate: '2026-11-11' }).endDate);
});

test('report values use Vietnamese money/count/percent formats and do not turn unavailable numbers into zero', () => {
  assert.equal(formatReportMoney('1234567.50'), '1.234.567,5đ'); assert.equal(formatReportMoney(0), '0đ');
  assert.equal(formatReportCount(1234), '1.234'); assert.equal(formatReportPercent(33.33), '33,33%');
  assert.equal(formatReportPercent(0), '0%');
  for (const value of [null, undefined, '', NaN, Infinity, -1, 'wrong']) {
    assert.equal(reportNumber(value), null); assert.equal(formatReportMoney(value), '—'); assert.equal(formatReportCount(value), '—'); assert.equal(formatReportPercent(value), '—');
  }
});

test('chart selects top ten without changing the full table data and distinguishes duplicated names by ID', () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, label: 'Tên phim trùng nhau rất dài để kiểm tra', revenue: String(index * 1000) }));
  const before = structuredClone(rows);
  const chart = selectRevenueChartRows(rows);
  assert.equal(chart.length, 10); assert.equal(chart[0].id, 12); assert.equal(chart.at(-1).id, 3);
  assert.ok(chart[0].fullLabel.includes('#12')); assert.ok(chart[0].axisLabel.includes('…'));
  assert.notEqual(chart[0].axisLabel, chart[1].axisLabel); assert.deepEqual(rows, before);
  assert.deepEqual(selectRevenueChartRows([{ id: 2, revenue: 10 }, { id: 1, revenue: 10 }]).map(row => row.id), [1, 2]);
  assert.equal(selectRevenueChartRows([{ id: 1, revenue: null }]).length, 0);
});
