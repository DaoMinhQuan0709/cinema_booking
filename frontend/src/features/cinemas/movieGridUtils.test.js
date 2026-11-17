import test from 'node:test';
import assert from 'node:assert/strict';
import { AGE_RATING_STYLE, buildMovieLookup } from './movieGridUtils.js';

test('tra cứu phim hỗ trợ trang phân trang và mảng, không ghi đè, bỏ mục sai', () => {
  const lookup = buildMovieLookup(
    { content: [{ id: 1, ageRating: 'P' }, null, {}] },
    [{ id: 1, ageRating: 'C18' }, { id: 2, ageRating: 'C13' }],
    undefined, { content: 'sai' },
  );
  assert.equal(lookup.get('1').ageRating, 'P');
  assert.equal(lookup.get('2').ageRating, 'C13');
  assert.equal(lookup.size, 2);
});

test('có màu cho đủ bốn nhãn độ tuổi', () => {
  assert.deepEqual(Object.keys(AGE_RATING_STYLE), ['P', 'C13', 'C16', 'C18']);
});
