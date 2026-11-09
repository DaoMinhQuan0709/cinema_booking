import test from 'node:test';
import assert from 'node:assert/strict';
import { toStompWebSocketUrl } from './websocketUrl.js';

test('keeps existing HTTP endpoint configuration compatible with native STOMP', () => {
  assert.equal(toStompWebSocketUrl('http://localhost:8080/ws'), 'ws://localhost:8080/ws');
  assert.equal(toStompWebSocketUrl('https://cinema.example/ws?tenant=1'), 'wss://cinema.example/ws?tenant=1');
});

test('accepts explicit WebSocket URLs without changing the endpoint', () => {
  assert.equal(toStompWebSocketUrl('ws://localhost:8080/ws'), 'ws://localhost:8080/ws');
  assert.equal(toStompWebSocketUrl('wss://cinema.example/ws'), 'wss://cinema.example/ws');
});

test('resolves relative endpoints against the page origin using the secure transport', () => {
  assert.equal(toStompWebSocketUrl('/ws', 'https://cinema.example/booking/5716'), 'wss://cinema.example/ws');
});

test('rejects unsupported schemes and fragments before attempting a connection', () => {
  for (const value of ['file:///ws', 'javascript:alert(1)', 'https://cinema.example/ws#fragment']) {
    assert.throws(() => toStompWebSocketUrl(value));
  }
});
