/** Resolves selections against the cinemas actually available on the chosen date. */
export function resolveShowtimeFilters(groups, city, cinemaId) {
  const effectiveCity = groups.some((group) => group.city === city) ? city : 'ALL';
  const cinemasInCity = groups.filter((group) => effectiveCity === 'ALL' || group.city === effectiveCity);
  const effectiveCinemaId = cinemasInCity.some((group) => String(group.cinemaId) === String(cinemaId))
    ? String(cinemaId)
    : 'ALL';

  return { effectiveCity, effectiveCinemaId, cinemasInCity };
}
