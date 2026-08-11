import {
  classifyExplorerError,
  detectMalformedSearchInput,
  validateValidatorRouteParam
} from '../../helpers/explorerErrors';

describe('explorer error helpers', () => {
  it('classifies not-found responses into a non-retryable resource state', () => {
    const error = classifyExplorerError(
      {
        response: {
          status: 404
        }
      },
      { resourceLabel: 'block' }
    );

    expect(error.kind).toBe('not_found');
    expect(error.retryable).toBe(false);
    expect(error.title).toBe('block not found');
  });

  it('classifies edge and gateway timeouts as retryable timeout states', () => {
    const error = classifyExplorerError(
      {
        response: {
          status: 524
        },
        message: 'A timeout occurred while contacting the explorer backend.'
      },
      { resourceLabel: 'network status' }
    );

    expect(error.kind).toBe('timeout');
    expect(error.retryable).toBe(true);
    expect(error.message).toContain('network status request timed out');
  });

  it('classifies malformed upstream validation responses as invalid input states', () => {
    const error = classifyExplorerError(
      {
        code: 'ERR_BAD_REQUEST',
        response: {
          status: 422,
          data: {
            message: 'invalid address: hex string has length 4, want 40 for common.Address'
          }
        }
      },
      { resourceLabel: 'address lookup' }
    );

    expect(error.kind).toBe('invalid_input');
    expect(error.retryable).toBe(false);
    expect(error.message).toContain('invalid address');
  });

  it('classifies axios no-response failures as indexer unavailable instead of generic', () => {
    const error = classifyExplorerError(
      {
        isAxiosError: true,
        message: 'Network Error'
      },
      { resourceLabel: 'transaction feed' }
    );

    expect(error.kind).toBe('indexer_unavailable');
    expect(error.retryable).toBe(true);
    expect(error.message).toContain('could not reach the public transaction feed endpoint');
  });

  it('classifies browser fetch reachability failures as indexer unavailable', () => {
    const error = classifyExplorerError(
      {
        code: 'ERR_CONNECTION_REFUSED',
        message: 'net::ERR_CONNECTION_REFUSED'
      },
      { resourceLabel: 'explorer summary' }
    );

    expect(error.kind).toBe('indexer_unavailable');
    expect(error.retryable).toBe(true);
    expect(error.message).toContain('public explorer summary endpoint');
  });

  it('classifies rate-limited upstream responses as retryable unavailable states with clear messaging', () => {
    const error = classifyExplorerError(
      {
        response: {
          status: 429
        },
        message: 'Too many requests'
      },
      { resourceLabel: 'search' }
    );

    expect(error.kind).toBe('indexer_unavailable');
    expect(error.retryable).toBe(true);
    expect(error.title).toBe('Rate limited');
    expect(error.message).toContain('rate-limiting explorer requests');
  });

  it('respects structured upstream error kinds when they are already normalized by the API', () => {
    const error = classifyExplorerError(
      {
        response: {
          status: 503,
          data: {
            kind: 'indexer_unavailable',
            title: 'Indexer lagging',
            message: 'The upstream indexer is rebuilding projections.'
          }
        }
      },
      { resourceLabel: 'search' }
    );

    expect(error.kind).toBe('indexer_unavailable');
    expect(error.title).toBe('Indexer lagging');
    expect(error.message).toContain('rebuilding projections');
  });

  it('uses structured upstream detail codes to classify unsupported object types', () => {
    const error = classifyExplorerError(
      {
        response: {
          status: 400,
          data: {
            details: [
              {
                code: 'UNSUPPORTED_OBJECT_TYPE',
                reason: 'validator consensus addresses are not directly browsable'
              }
            ]
          }
        }
      },
      { resourceLabel: 'validator lookup' }
    );

    expect(error.kind).toBe('unsupported_object_type');
    expect(error.retryable).toBe(false);
    expect(error.message).toContain('public APIs do not support this validator lookup object type');
  });

  it('treats validator consensus lookups as unsupported object types', () => {
    const error = detectMalformedSearchInput('lithovalcons1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkux6ee');

    expect(error.kind).toBe('unsupported_object_type');
    expect(error.retryable).toBe(false);
  });

  it('rejects validator consensus route params in favor of operator addresses', () => {
    const error = validateValidatorRouteParam('lithovalcons1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkux6ee');

    expect(error.kind).toBe('unsupported_object_type');
    expect(error.message).toContain('validator operator address');
  });

  it('classifies DOMException AbortError as a retryable timeout state', () => {
    const abort = new Error('The user aborted a request.');
    abort.name = 'AbortError';

    const error = classifyExplorerError(abort, { resourceLabel: 'block feed' });

    expect(error.kind).toBe('timeout');
    expect(error.retryable).toBe(true);
    expect(error.message).toContain('block feed request timed out');
  });

  it('classifies DOMException TimeoutError as a retryable timeout state', () => {
    const timeoutError = new Error('Signal timed out.');
    timeoutError.name = 'TimeoutError';

    const error = classifyExplorerError(timeoutError, { resourceLabel: 'token catalog' });

    expect(error.kind).toBe('timeout');
    expect(error.retryable).toBe(true);
  });

  it('classifies DOMException NetworkError as indexer unavailable instead of generic', () => {
    const networkError = new Error('A network error occurred.');
    networkError.name = 'NetworkError';

    const error = classifyExplorerError(networkError, { resourceLabel: 'validator set' });

    expect(error.kind).toBe('indexer_unavailable');
    expect(error.retryable).toBe(true);
    expect(error.message).toContain('public validator set endpoint');
  });
});
