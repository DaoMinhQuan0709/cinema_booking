import test from 'node:test';
import assert from 'node:assert/strict';
import { getCinemaMapLinks, getCinemaPriceRows, getManualGoogleEmbedUrl } from './cinemaDetailInfoUtils.js';
import { cinemaGoogleMapEmbeds } from './cinemaGoogleMapEmbeds.js';

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

const sharedEmbed = '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12&amp;foo=bar" width="600" height="450" loading="lazy"></iframe>';

test('mã iframe Google Maps sao chép thủ công chỉ lấy src hợp lệ', () => {
  assert.equal(getManualGoogleEmbedUrl(sharedEmbed), 'https://www.google.com/maps/embed?pb=!1m18!1m12&foo=bar');
  assert.equal(getManualGoogleEmbedUrl('https://www.google.com/maps/embed?pb=!1m18'), 'https://www.google.com/maps/embed?pb=!1m18');
  for (const input of [null, '', '<iframe src="javascript:alert(1)"></iframe>',
    '<iframe src="https://evil.example/maps/embed?pb=test"></iframe>',
    '<iframe src="https://www.google.com.evil.example/maps/embed?pb=test"></iframe>',
    'https://www.google.com/maps/embed/v1/place?key=test&q=Hanoi',
    'https://www.google.com/maps/embed?pb=',
  ]) assert.equal(getManualGoogleEmbedUrl(input), null, String(input));
});

test('mọi mã nhúng Google Maps đang cấu hình có ID và URL hợp lệ', () => {
  for (const [id, html] of Object.entries(cinemaGoogleMapEmbeds)) {
    assert.match(id, /^[1-9]\d*$/);
    assert.ok(getManualGoogleEmbedUrl(html), `Mã nhúng của rạp ${id} không hợp lệ`);
  }
});

test('bản đồ thủ công theo rạp; chỉ đường ưu tiên tọa độ hợp lệ', () => {
  const cinema = { name: 'Galaxy Hà Nội', address: '175 Nguyễn Thái Học', city: 'Hà Nội', latitude: 21.03, longitude: 105.84 };
  const links = getCinemaMapLinks(cinema, sharedEmbed);
  assert.equal(links.embedUrl, 'https://www.google.com/maps/embed?pb=!1m18!1m12&foo=bar');
  assert.equal(new URL(links.directionsUrl).searchParams.get('destination'), '21.03,105.84');
  assert.equal(new URL(links.directionsUrl).searchParams.get('api'), '1');
});

test('chưa có mã nhúng thì không hiện iframe, vẫn giữ chỉ đường', () => {
  const links = getCinemaMapLinks({ latitude: 21.033, longitude: 105.839 });
  assert.equal(links.embedUrl, null);
  assert.equal(new URL(links.directionsUrl).searchParams.get('destination'), '21.033,105.839');
});

test('thiếu tọa độ chỉ đường dùng địa chỉ; mã iframe vẫn dùng được khi thiếu địa chỉ', () => {
  const address = { name: 'Galaxy Đà Nẵng', address: 'Điện Biên Phủ', city: 'Đà Nẵng', latitude: 999, longitude: null };
  const links = getCinemaMapLinks(address);
  assert.equal(links.embedUrl, null);
  assert.equal(new URL(links.directionsUrl).searchParams.get('destination'), 'Galaxy Đà Nẵng, Điện Biên Phủ, Đà Nẵng');
  assert.deepEqual(getCinemaMapLinks({ name: 'Rạp chưa có địa chỉ' }, sharedEmbed), {
    embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12&foo=bar', directionsUrl: null,
  });
});
