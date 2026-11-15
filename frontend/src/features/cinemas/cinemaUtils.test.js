import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterCinemas, getCinemaCities, getCinemaCity, getCinemaImageSources, getCinemaPhoneHref,
  getCinemaScheduleHref, normalizeCinemaSearch, readCinemaFilters, UNKNOWN_CITY, writeCinemaFilters,
} from './cinemaUtils.js';

const cinemas = [
  { id: 3, name: 'Galaxy Đà Nẵng', city: 'Đà Nẵng', displayOrder: 2 },
  { id: 2, name: 'Galaxy Gò Vấp', city: 'TP. Hồ Chí Minh', displayOrder: 0 },
  { id: 1, name: 'Galaxy Hà Nội', city: 'Hà Nội', displayOrder: 2 },
  { id: 4, name: 'Rạp địa phương', city: null, displayOrder: null },
];

test('tìm tên tiếng Việt không phân biệt dấu, Đ/đ, hoa thường và khoảng trắng', () => {
  assert.equal(normalizeCinemaSearch('  ĐÀ  NẴNG '), 'da nang');
  assert.equal(normalizeCinemaSearch('Đà Nẵng'.normalize('NFD')), 'da nang');
  assert.deepEqual(filterCinemas(cinemas, { q: 'GO VAP' }).map(c => c.id), [2]);
  assert.deepEqual(filterCinemas(cinemas, { q: 'da nang' }).map(c => c.id), [3]);
  assert.equal(filterCinemas(cinemas, { q: '   ' }).length, 4);
});

test('lọc tên kết hợp tỉnh/thành, giữ nhóm chưa xác định và lựa chọn không có kết quả', () => {
  assert.deepEqual(filterCinemas(cinemas, { q: 'galaxy', city: 'Hà Nội' }).map(c => c.id), [1]);
  assert.deepEqual(filterCinemas(cinemas, { city: UNKNOWN_CITY }).map(c => c.id), [4]);
  assert.equal(filterCinemas(cinemas, { q: 'galaxy', city: 'Tỉnh chưa có rạp' }).length, 0);
  assert.equal(getCinemaCity({ city: '  ' }), UNKNOWN_CITY);
  assert.equal(getCinemaCity({ city: ' Hà Nội ' }), 'Hà Nội');
});

test('sắp xếp thứ tự 0 trước, thiếu thứ tự sau, tên/ID ổn định và không sửa cache gốc', () => {
  const input = structuredClone(cinemas);
  assert.deepEqual(filterCinemas(input).map(c => c.id), [2, 3, 1, 4]);
  assert.deepEqual(input, cinemas);
  assert.deepEqual(filterCinemas([
    { id: 10, name: 'Rạp A' }, { id: 2, name: 'Rạp A' }, { id: 1, name: 'Rạp Z', displayOrder: NaN },
  ]).map(c => c.id), [2, 10, 1]);
});

test('tỉnh/thành lấy từ toàn bộ catalog, bỏ trùng và xếp nhóm chưa xác định cuối', () => {
  assert.deepEqual(getCinemaCities([...cinemas, { city: ' Hà Nội ' }, { city: '' }]), [
    'Đà Nẵng', 'Hà Nội', 'TP. Hồ Chí Minh', UNKNOWN_CITY,
  ]);
  assert.deepEqual(getCinemaCities([]), []);
});

test('URL giữ tiếng Việt, giới hạn độ dài, bỏ tham số trùng và giữ tham số ngoài bộ lọc', () => {
  const original = new URLSearchParams('q=old&q=other&city=old&ref=footer');
  const next = writeCinemaFilters(original, { q: 'Gò Vấp', city: ' Hà Nội ' });
  assert.deepEqual(readCinemaFilters(next), { q: 'Gò Vấp', city: 'Hà Nội' });
  assert.equal(next.getAll('q').length, 1);
  assert.equal(next.get('ref'), 'footer');
  assert.equal(original.get('q'), 'old');
  assert.equal(writeCinemaFilters(next, { q: '  ', city: '' }).toString(), 'ref=footer');
  assert.equal(readCinemaFilters(new URLSearchParams({ q: 'a'.repeat(300), city: 'x'.repeat(300) })).q.length, 200);
  assert.equal(readCinemaFilters(new URLSearchParams({ city: 'x'.repeat(300) })).city.length, 200);
});

test('ảnh ưu tiên ngang rồi dọc/gallery, loại trùng và từ chối scheme không phải HTTP(S)', () => {
  assert.deepEqual(getCinemaImageSources({
    imageLandscape: ' https://cdn.example.invalid/wide.jpg ', imagePortrait: 'https://cdn.example.invalid/tall.jpg',
    imageUrls: ['https://cdn.example.invalid/wide.jpg', 'javascript:alert(1)', 'data:image/png;base64,abc', null, {}, '/relative.jpg', 'https://cdn.example.invalid/gallery.jpg'],
  }), ['https://cdn.example.invalid/wide.jpg', 'https://cdn.example.invalid/tall.jpg', 'https://cdn.example.invalid/gallery.jpg']);
  assert.deepEqual(getCinemaImageSources({ imageUrls: 'không phải mảng' }), []);
});

test('điện thoại chỉ tạo tel cho số hợp lệ, giữ được đầu + và số 0', () => {
  assert.equal(getCinemaPhoneHref('1900 2224'), 'tel:19002224');
  assert.equal(getCinemaPhoneHref('(+84) 028-1234.5678'), null);
  assert.equal(getCinemaPhoneHref('+84 (28) 1234-5678'), 'tel:+842812345678');
  assert.equal(getCinemaPhoneHref('028 1234 5678'), 'tel:02812345678');
  for (const phone of [undefined, '', 'javascript:alert(1)', '1900;1234', '1900#12', 'abc1900', '+12', '1'.repeat(21)]) {
    assert.equal(getCinemaPhoneHref(phone), null);
  }
});

test('liên kết lịch dùng bigint nội bộ, từ chối mã Galaxy, số 0, dấu âm và tràn ID', () => {
  assert.equal(getCinemaScheduleHref(12), '/showtimes?cinemaId=12');
  assert.equal(getCinemaScheduleHref('9223372036854775807'), '/showtimes?cinemaId=9223372036854775807');
  for (const id of [0, -1, '', null, '1011-12345', 'galaxy-uuid', '9223372036854775808', '1&movieId=2']) {
    assert.equal(getCinemaScheduleHref(id), null);
  }
});

test('tìm/lọc danh sách 200 rạp giữ đúng kết quả mà không cắt trang ngầm', () => {
  const input = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, name: `Rạp số ${i}`, city: i % 2 ? 'Hà Nội' : 'Đà Nẵng' }));
  assert.equal(filterCinemas(input).length, 200);
  assert.equal(filterCinemas(input, { city: 'Hà Nội' }).length, 100);
  assert.equal(filterCinemas(input, { q: 'rap so 199' })[0].id, 200);
});
