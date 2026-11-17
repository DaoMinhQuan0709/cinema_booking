import test from 'node:test';
import assert from 'node:assert/strict';
import { getCinemaMapLinks, getCinemaPriceRows } from './cinemaDetailInfoUtils.js';

test('giá cơ bản nhóm theo phim, bỏ giá và ID suất không hợp lệ', () => {
  const rows = getCinemaPriceRows([
    { movieId: '10', title: 'Phim A', showtimes: [
      { id: 501, basePrice: 89000 }, { id: 502, basePrice: '109000.50' },
      { id: 'galaxy-503', basePrice: 1000 }, { id: 504, basePrice: null },
    ] },
    { movieId: '11', title: 'Phim B', showtimes: [{ id: 505, basePrice: 0 }, { id: 506, basePrice: 'Infinity' }] },
  ]);
  assert.deepEqual(rows, [{ movieId: '10', title: 'Phim A', min: 89000, max: 109000.5 }]);
  assert.deepEqual(getCinemaPriceRows([]), []);
});

test('bản đồ ưu tiên tọa độ hợp lệ của rạp và mã hóa URL an toàn', () => {
  const cinema = { name: 'Galaxy Hà Nội', address: '175 Nguyễn Thái Học', city: 'Hà Nội', latitude: 21.03, longitude: 105.84 };
  const links = getCinemaMapLinks(cinema, 'test-key');
  assert.equal(links.embedProvider, 'google');
  assert.equal(new URL(links.embedUrl).searchParams.get('q'), '21.03,105.84');
  assert.equal(new URL(links.embedUrl).searchParams.get('key'), 'test-key');
  assert.equal(new URL(links.directionsUrl).searchParams.get('destination'), '21.03,105.84');
  assert.equal(new URL(links.directionsUrl).searchParams.get('api'), '1');
});

test('thiếu key dùng OpenStreetMap khi có tọa độ, không cần billing', () => {
  const links = getCinemaMapLinks({ latitude: 21.033, longitude: 105.839 });
  const url = new URL(links.embedUrl);
  assert.equal(links.embedProvider, 'openstreetmap');
  assert.equal(url.origin, 'https://www.openstreetmap.org');
  assert.equal(url.pathname, '/export/embed.html');
  assert.equal(url.searchParams.get('marker'), '21.033,105.839');
  assert.equal(url.searchParams.get('bbox'), '105.834000,21.030000,105.844000,21.036000');
  assert.equal(new URL(links.directionsUrl).searchParams.get('destination'), '21.033,105.839');
});

test('thiếu tọa độ chỉ còn chỉ đường; thiếu vị trí thì không tạo URL bản đồ', () => {
  const address = { name: 'Galaxy Đà Nẵng', address: 'Điện Biên Phủ', city: 'Đà Nẵng', latitude: 999, longitude: null };
  const links = getCinemaMapLinks(address);
  assert.equal(links.embedUrl, null);
  assert.equal(links.embedProvider, null);
  assert.equal(new URL(links.directionsUrl).searchParams.get('destination'), 'Galaxy Đà Nẵng, Điện Biên Phủ, Đà Nẵng');
  assert.deepEqual(getCinemaMapLinks({ name: 'Rạp chưa có địa chỉ' }, 'test-key'), { embedUrl: null, embedProvider: null, directionsUrl: null });
});
