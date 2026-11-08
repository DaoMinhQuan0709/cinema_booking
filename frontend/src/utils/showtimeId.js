/** Booking URLs use the positive PostgreSQL bigint ID, not Galaxy's session code. */
export function isInternalShowtimeId(value) {
  const id = String(value ?? '');
  return /^[1-9]\d{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n;
}

export function retryShowtimeRequest(failureCount, error) {
  const status = error?.response?.status;
  return failureCount < 1 && (!status || status >= 500);
}
