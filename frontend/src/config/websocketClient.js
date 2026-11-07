import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { WS_BASE_URL } from './constants';
import { tokenStorage } from './tokenStorage';

/**
 * Client STOMP dung chung cho toan app, ket noi qua SockJS toi endpoint
 * /ws cua backend (xem WebSocketConfig.java). Dung singleton de tranh
 * mo nhieu ket noi WebSocket song song khi nhieu component/trang cung
 * can subscribe (vd: trang chon ghe + widget khac trong tuong lai).
 *
 * Topic chinh: /topic/showtimes/{showtimeId}/seats
 * Payload nhan duoc khop SeatStatusUpdateMessage.java ben backend:
 *   { showtimeId, seatIds: number[], status: 'AVAILABLE'|'LOCKED'|'BOOKED',
 *     action: 'HOLD'|'RELEASE'|'BOOKED', timestamp }
 */

let stompClient = null;

function createClient() {
  return new Client({
    webSocketFactory: () => new SockJS(WS_BASE_URL),
    connectHeaders: {
      Authorization: `Bearer ${tokenStorage.getAccessToken() ?? ''}`,
    },
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    // Tat log STOMP mac dinh; bat lai console.log khi can debug ket noi
    debug: () => {},
  });
}

function getStompClient() {
  if (!stompClient) {
    stompClient = createClient();
  }
  return stompClient;
}

/**
 * Dam bao client da ket noi, tra ve Promise<Client> resolve khi connected.
 * An toan goi nhieu lan: neu da connected thi resolve ngay.
 */
function ensureConnected() {
  const client = getStompClient();

  if (client.connected) {
    return Promise.resolve(client);
  }

  return new Promise((resolve, reject) => {
    const prevOnConnect = client.onConnect;
    const prevOnStompError = client.onStompError;

    client.onConnect = (frame) => {
      prevOnConnect?.(frame);
      resolve(client);
    };
    client.onStompError = (frame) => {
      prevOnStompError?.(frame);
      reject(new Error(frame.headers?.message || 'Loi ket noi STOMP'));
    };

    if (!client.active) {
      client.activate();
    }
  });
}

/**
 * Subscribe vao topic cap nhat ghe real-time cua 1 suat chieu.
 *
 * @param {number|string} showtimeId
 * @param {(payload: object) => void} onMessage goi moi khi co message moi
 * @returns {Promise<() => void>} ham unsubscribe, goi trong cleanup cua useEffect
 */
export async function subscribeShowtimeSeats(showtimeId, onMessage) {
  const client = await ensureConnected();

  const subscription = client.subscribe(`/topic/showtimes/${showtimeId}/seats`, (message) => {
    try {
      onMessage(JSON.parse(message.body));
    } catch (err) {
      console.error('Khong the parse STOMP message:', err, message.body);
    }
  });

  return () => subscription.unsubscribe();
}

/**
 * Ngat ket noi WebSocket hoan toan (vd: khi logout). Lan subscribe tiep theo
 * se tu tao lai client va ket noi moi.
 */
export function disconnectStompClient() {
  if (stompClient) {
    stompClient.deactivate();
    stompClient = null;
  }
}

export { getStompClient, ensureConnected };
