import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScheduleDays } from '../showtimes/scheduleUtils.js';
import {
  dropUnavailableMovie, getOpenShowtimes, getVietnamNowKey, groupMoviesFromShowtimes,
  isValidDateKey, normalizeDetailParams, readDetailSelection, writeDetailSelection,
} from './cinemaDetailUtils.js';

const days = ['17', '18', '19', '20', '21', '22', '23'].map(day => ({ date: `2026-11-${day}` }));
const params = query => new URLSearchParams(query);

test('ngày phải đúng định dạng và tồn tại trên lịch', () => {
  assert.equal(isValidDateKey('2026-11-17'), true);
  assert.equal(isValidDateKey('0096-02-29'), true);
  for (const value of ['0099-02-29', '2026-02-30', '2026-13-01', '2026-1-1', '17/11/2026', '', null, undefined, 20261117]) {
    assert.equal(isValidDateKey(value), false);
  }
});

test('mặc định là hôm nay; ngày sai/ngoài dải rơi về hôm nay; movieId chỉ nhận ID nội bộ', () => {
  assert.deepEqual(readDetailSelection(params(''), days), { date: '2026-11-17', movieId: '', dateInRange: false });
  assert.equal(readDetailSelection(params('date=2026-11-20&movieId=10'), days).date, '2026-11-20');
  assert.equal(readDetailSelection(params('date=2026-11-20&movieId=10'), days).movieId, '10');
  for (const date of ['2026-11-16', '2026-11-24', '2026-02-30', 'abc']) {
    const result = readDetailSelection(params({ date }), days);
    assert.equal(result.date, '2026-11-17');
    assert.equal(result.dateInRange, false);
  }
  for (const movieId of ['0', '-1', '1011-226432', '1e3', '9223372036854775808']) {
    assert.equal(readDetailSelection(params({ movieId }), days).movieId, '');
  }
  assert.equal(readDetailSelection(params('date=2026-11-18'), []).date, '');
  const yearBoundaryDays = buildScheduleDays(new Date('2026-12-31T17:00:00Z'));
  assert.equal(yearBoundaryDays[0].date, '2027-01-01');
  assert.equal(readDetailSelection(params('date=2027-01-07'), yearBoundaryDays).date, '2027-01-07');
  assert.equal(readDetailSelection(params('date=2026-12-31'), yearBoundaryDays).date, '2027-01-01');
});

test('ghi URL chỉ đổi khóa được nêu, giữ tham số khác, bỏ trùng và không sửa bản gốc', () => {
  const original = params('movieId=5&ref=a&date=2026-11-18&date=2026-11-19');
  const cleared = writeDetailSelection(original, { movieId: '' });
  assert.equal(cleared.toString(), 'ref=a&date=2026-11-18&date=2026-11-19');
  assert.equal(writeDetailSelection(original, { date: '2026-11-20' }).toString(), 'movieId=5&ref=a&date=2026-11-20');
  assert.equal(writeDetailSelection(original, { movieId: 7, date: '' }).toString(), 'movieId=7&ref=a');
  assert.equal(original.toString(), 'movieId=5&ref=a&date=2026-11-18&date=2026-11-19');
});

test('chuẩn hóa URL: bỏ ngày/phim sai, không tự thêm date, URL đã chuẩn giữ nguyên', () => {
  assert.equal(normalizeDetailParams(params('date=2026-12-01&movieId=abc&ref=x&date=2026-11-18'), days).toString(), 'ref=x');
  assert.equal(normalizeDetailParams(params('ref=x'), days).toString(), 'ref=x');
  assert.equal(normalizeDetailParams(params('date=2026-11-18&date=2026-11-19'), days).toString(), 'date=2026-11-18');
  const canonical = 'date=2026-11-18&movieId=5&ref=a';
  assert.equal(normalizeDetailParams(params(canonical), days).toString(), canonical);
});

test('giờ Việt Nam đúng quanh nửa đêm và không ra giờ 24', () => {
  assert.equal(getVietnamNowKey(new Date('2026-11-16T16:59:59Z')), '2026-11-16T23:59:59');
  assert.equal(getVietnamNowKey(new Date('2026-11-16T17:00:00Z')), '2026-11-17T00:00:00');
  assert.equal(getVietnamNowKey(new Date('2026-11-17T05:05:09Z')), '2026-11-17T12:05:09');
});

test('chỉ giữ suất bắt đầu sau hiện tại; chấp nhận giờ không có giây, bỏ giờ sai, qua nửa đêm vẫn đúng', () => {
  const at = startTime => ({ id: 1, startTime });
  const now = '2026-11-17T18:00:00';
  assert.deepEqual(getOpenShowtimes([
    at('2026-11-17T17:59:59'), at('2026-11-17T18:00:00'), at('2026-11-17T18:00'),
    at('2026-11-17T18:01'), at('2026-11-17T18:02:00.123456'),
    at('2026-02-30T19:00:00'), at('2026-11-17T24:00:00'), at('2026-11-17T19:60:00'),
    at('2026-11-17T19:00:60'), at('2026-11-17T19:00junk'),
    at('2026-11-17T19:00:00Z'), at('bad'), at(null), at(undefined), null,
  ], now).map(s => s.startTime), ['2026-11-17T18:01', '2026-11-17T18:02:00.123456']);
  assert.equal(getOpenShowtimes([at('2026-11-18T00:30:00')], '2026-11-17T23:59:59').length, 1);
  assert.equal(getOpenShowtimes([at('2026-11-17T23:59:59')], '2026-11-18T00:00:00').length, 0);
});

test('gom suất theo phim, sắp theo suất sớm nhất rồi giờ, bỏ dữ liệu sai và không sửa đầu vào', () => {
  const input = [
    { id: 2, movieId: 10, movieTitle: ' Phim B ', posterUrl: 'p.jpg', startTime: '2026-11-17T20:00:00' },
    { id: 1, movieId: 10, startTime: '2026-11-17T18:00:00' },
    { id: 3, movieId: 11, movieTitle: 'Phim A', startTime: '2026-11-17T17:00:00' },
    { id: 4, movieId: 'x', movieTitle: 'Sai ID', startTime: '2026-11-17T19:00:00' },
    { id: 5, movieId: 12, movieTitle: 'Sai giờ', startTime: 'bad' },
    { id: 6, movieId: 13, startTime: '2026-11-17T21:00:00' },
    { id: 7, movieId: 14, startTime: '2026-11-17T25:00:00' },
    { id: 8, movieId: 15, startTime: '2026-11-17T22:00:00junk' },
    { id: 9, movieId: 16, movieTitle: 123, posterUrl: 456, startTime: '2026-11-17T22:30:00' },
    null,
  ];
  const before = structuredClone(input);
  const movies = groupMoviesFromShowtimes(input);
  assert.deepEqual(movies.map(m => m.movieId), ['11', '10', '13', '16']);
  assert.deepEqual(movies[1].showtimes.map(s => s.id), [1, 2]);
  assert.equal(movies[1].title, 'Phim B');
  assert.equal(movies[1].posterUrl, 'p.jpg');
  assert.equal(movies[2].title, 'Phim chưa có tên');
  assert.equal(movies[3].title, 'Phim chưa có tên');
  assert.equal(movies[3].posterUrl, null);
  assert.deepEqual(input, before);
  assert.deepEqual(groupMoviesFromShowtimes([]), []);
});

test('xóa movieId không còn suất; giữ nguyên tham chiếu khi hợp lệ hoặc không có movieId', () => {
  const movies = [{ movieId: '10' }, { movieId: '11' }];
  const valid = params('movieId=10&date=2026-11-18');
  assert.equal(dropUnavailableMovie(valid, movies), valid);
  const none = params('date=2026-11-18');
  assert.equal(dropUnavailableMovie(none, movies), none);
  assert.equal(dropUnavailableMovie(params('movieId=99&date=2026-11-18&ref=a'), movies).toString(), 'date=2026-11-18&ref=a');
  assert.equal(dropUnavailableMovie(params('movieId=abc'), movies).toString(), '');
  assert.equal(dropUnavailableMovie(params('movieId=10'), []).toString(), '');
});
