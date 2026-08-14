import { describe, expect, it } from 'vitest';
import { isReauthorizationError } from '../server/googleAuth';

describe('Google OAuth authorization recovery', () => {
  it('requires a new authorization when Google reports a revoked or inaccessible file grant', () => {
    expect(isReauthorizationError({ response: { status: 401 } })).toBe(true);
    expect(isReauthorizationError({ response: { data: { error: 'invalid_grant' } } })).toBe(true);
    expect(isReauthorizationError({
      response: { data: { error: { errors: [{ reason: 'insufficientFilePermissions' }] } } },
    })).toBe(true);
  });

  it('does not retry ordinary provider validation errors as authorization failures', () => {
    expect(isReauthorizationError({ response: { status: 400 } })).toBe(false);
    expect(isReauthorizationError({ response: { status: 429 } })).toBe(false);
  });
});
