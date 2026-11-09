// The browser bundle provides its own global shim; the lib entry assumes Node's global.
import SockJS from 'sockjs-client/dist/sockjs.js';
import { Client } from '@stomp/stompjs';
import { WS_BASE_URL } from './constants';
import { tokenStorage } from './tokenStorage';

/**
 * Client STOMP dung chung cho toan app, ket noi qua SockJS toi endpoint
 * /ws cua backend (xem WebSocketConfig.java). Dung singleton de tranh
 * mo nhieu ket noi WebSocket song song.
 *
 * Topic chinh: /topic/showtimes/{showtimeId}/seats
 * Payload khop SeatStatusUpdateMessage.java ben backend:
 *   { showtimeId, seatIds: number[], status: 'AVAILABLE'|'LOCKED'|'BOOKED',
 *     action: 'HOLD'|'RELEASE'|'BOOKED', timestamp }
 *
 * LUU Y: STOMP KHONG tu khoi phuc subscription sau khi reconnect, nen moi
 * subscriber duoc luu trong `subscribers` va dang ky lai moi lan onConnect chay.
 */

let stompClient = null;
const subscribers = new Set();

function attach(entry, client) {
  entry.stompSubscription = client.subscribe(entry.destination, (message) => {
    try {
      entry.onMessage(JSON.parse(message.body));
    } catch (err) {
      console.error('Khong the parse STOMP message:', err, message.body);
    }
  });
  entry.onConnect?.();
}

function createClient() {
  const client = new Client({
    webSocketFactory: () => new SockJS(WS_BASE_URL),
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    // Tat log STOMP mac dinh; bat lai console.log khi can debug ket noi
    debug: () => {},
    // Doc token moi nhat o moi lan (re)connect
    beforeConnect: () => {
      const token = tokenStorage.getAccessToken();
      client.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    },
  });

  client.onConnect = () => {
    // Bo qua client cu da bi deactivate (vd: React StrictMode mount/unmount nhanh)
    if (client !== stompClient) return;
    subscribers.forEach((entry) => attach(entry, client));
  };

  client.onWebSocketClose = () => {
    if (client !== stompClient) return;
    subscribers.forEach((entry) => {
      entry.stompSubscription = null;
      entry.onDisconnect?.();
    });
  };

  return client;
}

function getStompClient() {
  if (!stompClient) {
    stompClient = createClient();
  }
  return stompClient;
}

/**
 * Ngat ket noi WebSocket hoan toan. Lan subscribe tiep theo se tu tao lai client.
 */
export function disconnectStompClient() {
  if (stompClient) {
    const client = stompClient;
    stompClient = null;
    client.deactivate();
  }
}

/**
 * Subscribe vao topic cap nhat ghe real-time cua 1 suat chieu.
 * Tu dong ket noi neu chua ket noi, tu dang ky lai sau moi lan reconnect.
 *
 * @param {number|string} showtimeId
 * @param {{
 *   onMessage: (payload: object) => void,
 *   onConnect?: () => void,     // goi moi khi subscription san sang (ke ca sau reconnect)
 *   onDisconnect?: () => void,  // goi khi mat ket noi
 * }} handlers
 * @returns {() => void} ham unsubscribe, goi trong cleanup cua useEffect
 */
export function subscribeShowtimeSeats(showtimeId, { onMessage, onConnect, onDisconnect }) {
  const client = getStompClient();
  const entry = {
    destination: `/topic/showtimes/${showtimeId}/seats`,
    onMessage,
    onConnect,
    onDisconnect,
    stompSubscription: null,
  };
  subscribers.add(entry);

  if (client.connected) {
    attach(entry, client);
  } else if (!client.active) {
    client.activate();
  }

  return () => {
    subscribers.delete(entry);
    try {
      entry.stompSubscription?.unsubscribe();
    } catch {
      // Ket noi da dong, khong can unsubscribe
    }
    // Khong con ai lang nghe -> dong ket noi de khong giu socket thua
    if (subscribers.size === 0) disconnectStompClient();
  };
}

export { getStompClient };
