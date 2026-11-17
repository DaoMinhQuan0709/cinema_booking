/** Màu nhãn độ tuổi, khớp MovieCard (P nhẹ nhất → C18 nặng nhất). */
export const AGE_RATING_STYLE = {
  P: 'border-emerald-500 text-emerald-400 bg-emerald-500/10',
  C13: 'border-amber-500 text-amber-400 bg-amber-500/10',
  C16: 'border-orange-500 text-orange-400 bg-orange-500/10',
  C18: 'border-primary text-primary bg-primary/10',
};

/**
 * Tra cứu phim theo ID từ các danh sách phim đã cache (ShowtimeResponse không có ageRating).
 * Nhận trang phân trang ({ content }) hoặc mảng; danh sách đến sau không ghi đè phim đã có,
 * mục sai cấu trúc bị bỏ qua.
 * @param {...(object|object[]|undefined)} lists
 * @returns {Map<string, object>}
 */
export function buildMovieLookup(...lists) {
  const lookup = new Map();
  for (const list of lists) {
    const items = Array.isArray(list) ? list : list?.content;
    if (!Array.isArray(items)) continue;
    for (const movie of items) {
      if (movie?.id != null && !lookup.has(String(movie.id))) lookup.set(String(movie.id), movie);
    }
  }
  return lookup;
}
