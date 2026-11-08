const VND_FORMATTER = new Intl.NumberFormat('vi-VN');

/**
 * Dinh dang so tien VND, vd: 120000 -> "120.000đ".
 * @param {number|string|null|undefined} value
 */
export function formatCurrency(value) {
  if (value == null || value === '') return '0đ';
  return `${VND_FORMATTER.format(Number(value))}đ`;
}
