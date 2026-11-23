import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';

const origin = new URL(process.env.CINEMA_ORIGIN);
assert.equal(origin.protocol, 'http:');
assert.equal(origin.hostname, '127.0.0.1', 'Run smoke checks against the isolated loopback stack');
const merchant = 'CIPAY001';
const signingKey = 'cinema-ci-sandbox-signing-key';

async function request(path, { status = 200, method = 'GET', body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(new URL(path, origin), {
    method, headers, body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, status, `${method} ${path.split('?')[0]}`);
  return response;
}

async function json(path, options) {
  const response = await request(path, options);
  assert.match(response.headers.get('content-type'), /^application\/json\b/);
  return response.json();
}

async function checkWebSocket() {
  const socket = new WebSocket(new URL(`ws://${origin.host}/ws`), 'v12.stomp');
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('STOMP connection timed out')), 8000);
      socket.addEventListener('open', () => {
        socket.send(`CONNECT\naccept-version:1.2\nhost:${origin.host}\nheart-beat:0,0\n\n\0`);
      }, { once: true });
      socket.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('Failed to connect to /ws through Caddy'));
      }, { once: true });
      socket.addEventListener('message', ({ data }) => {
        clearTimeout(timer);
        if (String(data).startsWith('CONNECTED\n')) resolve();
        else reject(new Error('Expected a STOMP CONNECTED frame'));
      }, { once: true });
    });
  } finally {
    socket.close();
  }
}

async function customer() {
  const body = { email: `deploy-${randomUUID()}@example.invalid`, password: `Smoke-${randomUUID()}` };
  await request('/api/v1/auth/register', {
    method: 'POST', status: 201, body: { ...body, fullName: 'Deploy smoke' },
  });
  const { data } = await json('/api/v1/auth/login', { method: 'POST', body });
  return data.accessToken;
}

const index = await (await request('/')).text();
const script = index.match(/src="(\/assets\/[^"\s]+\.js)"/)?.[1];
assert.ok(script, 'The SPA entry point references a built JavaScript asset');
assert.match((await request(script)).headers.get('content-type'), /javascript/);
for (const route of ['/admin', '/profile/bookings', '/payment/vnpay-callback']) {
  const response = await request(route);
  assert.equal(response.headers.get('cache-control'), 'no-cache');
  assert.equal(await response.text(), index);
}
await request('/actuator/health', { status: 404 });
await request('/assets/missing.js', { status: 404 });
assert.match((await request('/images/combo_solo.png')).headers.get('content-type'), /^image\/png\b/);
await checkWebSocket();

const ipn = '/api/v1/payments/vnpay-ipn';
assert.equal((await json(ipn)).RspCode, '97');
const { data: catalog } = await json('/api/v1/movies');
const movie = catalog.content.find(({ title }) => title === 'Cinema Booking Demo');
assert.ok(movie, 'The demo movie is listed');
const { data: showtimes } = await json(`/api/v1/showtimes?movieId=${movie.id}`);
assert.ok(showtimes.length, 'The demo has an upcoming showtime');
const { id: showtimeId } = showtimes[0];
const seatMap = `/api/v1/showtimes/${showtimeId}/seats`;
const { data: { seats } } = await json(seatMap);
const [seat, secondSeat] = seats.filter(({ status, seatType }) => status === 'AVAILABLE' && seatType === 'STANDARD');
assert.ok(secondSeat, 'The demo showtime has two available standard seats');

const bookings = '/api/v1/bookings';
const token = await customer();
const competingToken = await customer();
await request('/api/v1/admin/movies', { token, status: 403 });
const holdBody = { showtimeId, showtimeSeatIds: [seat.showtimeSeatId] };
const { data: hold } = await json(bookings, { method: 'POST', status: 201, body: holdBody, token });
await request(bookings, { method: 'POST', status: 409, body: holdBody, token: competingToken });

const { data: payment } = await json('/api/v1/payments/create-url', {
  method: 'POST', token,
  body: { bookingCode: hold.bookingCode, expectedRevision: hold.checkoutRevision, paymentMethod: 'VNPAY' },
});
assert.equal(payment.state, 'READY');
const paymentUrl = new URL(payment.paymentUrl);
assert.equal(paymentUrl.hostname, 'sandbox.vnpayment.vn');
assert.equal(paymentUrl.searchParams.get('vnp_TmnCode'), merchant);
assert.equal(paymentUrl.searchParams.get('vnp_ReturnUrl'), new URL('/payment/vnpay-callback', origin).href);

// A CI-only notification exercises settlement against the migrated schema.
const callback = new URLSearchParams({
  vnp_TmnCode: merchant,
  vnp_TxnRef: paymentUrl.searchParams.get('vnp_TxnRef'),
  vnp_Amount: paymentUrl.searchParams.get('vnp_Amount'),
  vnp_ResponseCode: '00',
  vnp_TransactionStatus: '00',
  vnp_TransactionNo: randomUUID().replaceAll('-', ''),
});
callback.sort();
callback.set('vnp_SecureHash', createHmac('sha512', signingKey).update(callback.toString()).digest('hex'));
assert.equal((await json(`${ipn}?${callback}`)).RspCode, '00');
assert.equal((await json(`${ipn}?${callback}`)).RspCode, '02');
assert.equal((await json(`${bookings}/${hold.bookingCode}`, { token })).data.status, 'CONFIRMED');
const qr = await request(`${bookings}/${hold.bookingCode}/qr`, { token });
assert.equal(qr.headers.get('content-type'), 'image/png');
assert.equal(Buffer.from(await qr.arrayBuffer()).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');

const { data: cancelled } = await json(bookings, {
  method: 'POST', status: 201, token,
  body: { showtimeId, showtimeSeatIds: [secondSeat.showtimeSeatId] },
});
await request(`${bookings}/${cancelled.bookingCode}/cancel`, { method: 'DELETE', token });
const { data: after } = await json(seatMap);
assert.equal(after.seats.find(({ showtimeSeatId }) => showtimeSeatId === seat.showtimeSeatId).status, 'BOOKED');
assert.equal(after.seats.find(({ showtimeSeatId }) => showtimeSeatId === secondSeat.showtimeSeatId).status, 'AVAILABLE');
console.log('SPA, proxy, STOMP, customer/auth, seat hold/release, CI IPN and QR checks passed');
