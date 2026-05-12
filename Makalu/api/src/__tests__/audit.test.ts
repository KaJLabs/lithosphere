import { afterEach, describe, expect, it, vi } from 'vitest';
import { audit, auditLogger } from '../lib/audit.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('audit logger', () => {
  it('emits info-level lines via the audit pino child', () => {
    const spy = vi.spyOn(auditLogger, 'info');
    audit({ action: 'faucet_claim_success', actor: '0xabc', amount: 5, txHash: '0xdef' }, 'ok');

    expect(spy).toHaveBeenCalledOnce();
    const [fields, message] = spy.mock.calls[0];
    expect(fields).toMatchObject({
      action: 'faucet_claim_success',
      actor: '0xabc',
      amount: 5,
      txHash: '0xdef',
    });
    expect(message).toBe('[audit:faucet_claim_success] ok');
  });

  it('stamps the category=audit field on every line (via the pino child binding)', () => {
    // The child binding is set at logger.child({ category: 'audit' }) creation
    // time; pino merges these into every emitted record automatically. We can
    // verify by inspecting the bindings on the child.
    const bindings = auditLogger.bindings();
    expect(bindings.category).toBe('audit');
  });

  it('preserves arbitrary detail fields without dropping unknowns', () => {
    const spy = vi.spyOn(auditLogger, 'info');
    audit(
      {
        action: 'faucet_claim_rejected',
        reason: 'rate_limited',
        actor: '0x123',
        cooldownSeconds: 3600,
        // Anything extra rides along into Loki:
        customField: { nested: true },
      },
      'rate limited',
    );

    expect(spy).toHaveBeenCalledOnce();
    const [fields] = spy.mock.calls[0];
    expect(fields).toMatchObject({
      action: 'faucet_claim_rejected',
      reason: 'rate_limited',
      cooldownSeconds: 3600,
      customField: { nested: true },
    });
  });
});
