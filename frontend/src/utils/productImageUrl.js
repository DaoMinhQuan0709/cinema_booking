/** Product paths are served by Spring, rather than by the frontend origin. */
export function productImageUrl(value, apiBaseUrl) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const source = value.trim();
  try {
    if (/^https?:\/\//i.test(source)) return new URL(source).href;
    if (!source.startsWith('/images/') || source.includes('\\')) return null;
    const base = new URL(apiBaseUrl, globalThis.location?.origin ?? 'http://localhost');
    const url = new URL(source, base.origin);
    return url.pathname.startsWith('/images/') ? url.href : null;
  } catch { return null; }
}
