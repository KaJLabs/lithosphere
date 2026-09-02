import test from 'node:test';
import assert from 'node:assert/strict';
import { metricMethod, metricRoute } from '../src/middleware/httpMetrics.js';

test('maps dynamic request paths to bounded route labels', () => {
  assert.equal(metricRoute('GET', '/bridge/status/0xabc'), '/bridge/status/:txHash');
  assert.equal(metricRoute('GET', '/tokens/0x123'), '/tokens/:tokenAddress');
  assert.equal(metricRoute('GET', '/health'), '/health');
});

test('collapses arbitrary and adversarial paths into one label', () => {
  const labels = new Set(Array.from({ length: 10_000 }, (_, i) => metricRoute('GET', `/attacker/${i}`)));
  assert.deepEqual([...labels], ['/unmatched']);
});

test('collapses arbitrary HTTP methods into one bounded label', () => {
  assert.equal(metricMethod('GET'), 'GET');
  assert.equal(metricMethod('ATTACKER-CONTROLLED'), 'OTHER');
});
