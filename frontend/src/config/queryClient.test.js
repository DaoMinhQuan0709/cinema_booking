import test from 'node:test';
import assert from 'node:assert/strict';
import { clearTicketCache, invalidateTicketCache, queryClient } from './queryClient.js';

test('xóa vé một phiên hủy request, bỏ list/detail/QR, giữ phiên khác và cache công khai', async () => {
  const keys = [['my-tickets', 'A', 'list'], ['my-tickets', 'A', 'detail', 'code'], ['my-tickets', 'A', 'qr', 'code'], ['my-tickets', 'B', 'list'], ['movies', 'public']];
  try {
    for (const key of keys) queryClient.setQueryData(key, 'cached');
    let signal, resolveRequest;
    const pending = queryClient.fetchQuery({ queryKey: ['my-tickets', 'A', 'pending'], retry: false,
      queryFn: context => { signal = context.signal; return new Promise(resolve => { resolveRequest = resolve; }); },
    }).catch(error => error);
    clearTicketCache('A');
    assert.equal(signal.aborted, true);
    resolveRequest('late private response');
    await pending;
    assert.equal(queryClient.getQueryCache().findAll({ queryKey: ['my-tickets', 'A'] }).length, 0);
    assert.equal(queryClient.getQueryData(keys[3]), 'cached');
    assert.equal(queryClient.getQueryData(keys[4]), 'cached');
    clearTicketCache();
    assert.equal(queryClient.getQueryCache().findAll({ queryKey: ['my-tickets'] }).length, 0);
    assert.equal(queryClient.getQueryData(keys[4]), 'cached');
  } finally { queryClient.clear(); }
});

test('invalidation chỉ đánh dấu vé đúng phiên, bỏ qua khi không có phiên', async () => {
  try {
    for (const key of [['my-tickets', 'A', 'list'], ['my-tickets', 'A', 'detail', 'code'], ['my-tickets', 'B', 'list'], ['movies']]) queryClient.setQueryData(key, 'cached');
    await invalidateTicketCache(null);
    assert.ok(queryClient.getQueryCache().getAll().every(query => !query.state.isInvalidated));
    await invalidateTicketCache('A');
    assert.ok(queryClient.getQueryCache().findAll({ queryKey: ['my-tickets', 'A'] }).every(query => query.state.isInvalidated));
    assert.equal(queryClient.getQueryState(['my-tickets', 'B', 'list']).isInvalidated, false);
    assert.equal(queryClient.getQueryState(['movies']).isInvalidated, false);
  } finally { queryClient.clear(); }
});
