import { describe, expect, it } from 'vitest';
import { createFixedWindowRateLimiter, resolveDistributedRateLimitFailureMode } from '../server/rateLimit';

describe('fixed-window API rate limiting', () => {
  it('limits one subject without affecting another and resets after its window', () => {
    const limiter = createFixedWindowRateLimiter({ maxRequests: 2, windowMs: 1_000 });

    expect(limiter.consume('user-a', 0).allowed).toBe(true);
    expect(limiter.consume('user-a', 1).allowed).toBe(true);
    expect(limiter.consume('user-a', 2)).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
    expect(limiter.consume('user-b', 2).allowed).toBe(true);
    expect(limiter.consume('user-a', 1_000).allowed).toBe(true);
  });

  it('rejects unsafe limiter configuration at startup', () => {
    expect(() => createFixedWindowRateLimiter({ maxRequests: 0, windowMs: 1_000 })).toThrow('maxRequests');
    expect(() => createFixedWindowRateLimiter({ maxRequests: 1, windowMs: 0 })).toThrow('windowMs');
  });

  it('honours an explicit fail-closed mode for distributed production limiting', () => {
    expect(resolveDistributedRateLimitFailureMode({ failureMode: 'deny' })).toBe('deny');
    expect(resolveDistributedRateLimitFailureMode({ failureMode: 'local-fallback' })).toBe('local-fallback');
  });
});
