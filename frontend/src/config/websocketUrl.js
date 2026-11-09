/** Accept existing HTTP SockJS URLs while connecting to the native STOMP endpoint. */
export function toStompWebSocketUrl(endpoint, baseUrl) {
  const url = new URL(endpoint, baseUrl);
  if (url.protocol === 'http:') url.protocol = 'ws:';
  else if (url.protocol === 'https:') url.protocol = 'wss:';
  if (!['ws:', 'wss:'].includes(url.protocol) || url.hash) {
    throw new Error('VITE_WS_BASE_URL phải là URL WebSocket hoặc HTTP hợp lệ, không chứa fragment.');
  }
  return url.href;
}
