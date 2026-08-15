import { describe, expect, it } from 'vitest';
import { isSessionExpired, SESSION_IDLE_TIMEOUT_MS } from '../src/lib/sessionPolicy';

describe('persistent session inactivity policy', () => {
  const now = Date.UTC(2026, 7, 15, 21, 0, 0);

  it('keeps a returning user signed in before 14 days of inactivity', () => {
    expect(isSessionExpired(now - SESSION_IDLE_TIMEOUT_MS + 1, now)).toBe(false);
  });

  it('expires the local session at 14 days of inactivity', () => {
    expect(isSessionExpired(now - SESSION_IDLE_TIMEOUT_MS, now)).toBe(true);
    expect(isSessionExpired(now - SESSION_IDLE_TIMEOUT_MS - 1, now)).toBe(true);
  });

  it('does not expire a first session or a future timestamp', () => {
    expect(isSessionExpired(undefined, now)).toBe(false);
    expect(isSessionExpired(now + 60_000, now)).toBe(false);
  });
});
