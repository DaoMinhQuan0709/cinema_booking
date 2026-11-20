/** Reject JSON/HTML or empty responses before exposing a downloadable PNG. */
export async function requireTicketPng(blob) {
  if (!(blob instanceof Blob) || blob.type.split(';')[0].trim().toLowerCase() !== 'image/png' || blob.size < 8) {
    throw new Error('Dữ liệu mã QR không phải ảnh PNG.');
  }
  const signature = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  if (![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => signature[index] === value)) {
    throw new Error('Dữ liệu mã QR không phải ảnh PNG.');
  }
  return blob;
}
