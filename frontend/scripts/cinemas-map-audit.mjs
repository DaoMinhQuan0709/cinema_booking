import assert from 'node:assert/strict';
import { cinemaGoogleMapEmbeds } from '../src/features/cinemas/cinemaGoogleMapEmbeds.js';
import { getManualGoogleEmbedUrl } from '../src/features/cinemas/cinemaDetailInfoUtils.js';

const base = process.env.CINEMAS_TEST_API_BASE || 'http://localhost:8080/api/v1';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+\/api\/v1$/.test(base)) throw new Error('API phải là loopback');

const response = await fetch(`${base}/cinemas`);
if (!response.ok) throw new Error(`GET /cinemas: HTTP ${response.status}`);
const catalog = (await response.json()).data;
if (!Array.isArray(catalog)) throw new Error('Catalog không phải mảng');
const byId = new Map(catalog.map(cinema => [String(cinema.id), cinema]));
const rad = Math.PI / 180;

const results = Object.entries(cinemaGoogleMapEmbeds).map(([id, html]) => {
  const cinema = byId.get(id);
  const url = getManualGoogleEmbedUrl(html);
  const pb = url ? new URL(url).searchParams.get('pb') : '';
  const match = pb?.match(/!2d(-?[\d.]+)!3d(-?[\d.]+)/);
  const latitude = Number(match?.[2]);
  const longitude = Number(match?.[1]);
  const dbLatitude = Number(cinema?.latitude);
  const dbLongitude = Number(cinema?.longitude);
  const a = Math.sin((latitude - dbLatitude) * rad / 2) ** 2
    + Math.cos(latitude * rad) * Math.cos(dbLatitude * rad) * Math.sin((longitude - dbLongitude) * rad / 2) ** 2;
  // Tọa độ trong pb là tâm khung bản đồ, không nhất thiết là vị trí marker.
  const mapCenterDistanceMeters = cinema && match && Number.isFinite(dbLatitude) && Number.isFinite(dbLongitude)
    ? Math.round(12742000 * Math.asin(Math.sqrt(a))) : null;
  const place = pb?.match(/!2([sz])([^!]+)!5e0/);
  const mapLabel = (place?.[1] === 'z' ? Buffer.from(place[2], 'base64').toString('utf8') : place?.[2] || '').replaceAll('*21', '!');
  return { id, name: cinema?.name ?? null, mapLabel, mapCenterDistanceMeters, validUrl: Boolean(url) };
});

const missingConfig = catalog.filter(cinema => !cinemaGoogleMapEmbeds[String(cinema.id)])
  .map(cinema => ({ id: cinema.id, name: cinema.name })).sort((a, b) => a.id - b.id);
const missingCatalog = results.filter(result => !result.name);
const invalidMaps = results.filter(result => !result.validUrl || !result.mapLabel);
console.log(JSON.stringify({ catalogCount: catalog.length, configuredCount: results.length,
  missingConfig, missingCatalog, invalidMaps, results }, null, 2));
assert.deepEqual(missingCatalog, [], 'Mã nhúng tham chiếu ID rạp không có trong API thật');
assert.deepEqual(invalidMaps, [], 'Mã nhúng Google Maps sai hoặc thiếu tên địa điểm');
