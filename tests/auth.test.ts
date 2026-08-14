import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));

vi.mock('../server/firebaseAdmin', () => ({
  getAdminAuth: () => ({ verifyIdToken }),
}));

import { requireFirebaseAuth } from '../server/auth';

async function runAuthentication(authorization?: string) {
  const req = { headers: { authorization } } as Request;
  let nextError: unknown;
  await requireFirebaseAuth(req, {} as Response, ((error?: unknown) => { nextError = error; }) as NextFunction);
  return { req, nextError };
}

describe('Firebase authentication boundary', () => {
  beforeEach(() => verifyIdToken.mockReset());

  it('derives the trusted uid from any verified Firebase identity token', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'trusted-uid',
      email: 'person@example.com',
      firebase: { sign_in_provider: 'google.com' },
    });

    const { req, nextError } = await runAuthentication('Bearer signed-token');

    expect(nextError).toBeUndefined();
    expect(verifyIdToken).toHaveBeenCalledWith('signed-token', true);
    expect(req.authContext).toMatchObject({ uid: 'trusted-uid', email: 'person@example.com' });
  });

  it('accepts only the server-marked custom token issued after Google verification', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'server-google-user',
      firebase: { sign_in_provider: 'custom' },
      billqoGoogleIdentity: true,
    });

    const allowed = await runAuthentication('Bearer server-issued-token');
    expect(allowed.nextError).toBeUndefined();
    expect(allowed.req.authContext).toMatchObject({ uid: 'server-google-user', provider: 'google.com' });

    verifyIdToken.mockResolvedValue({
      uid: 'untrusted-custom-user',
      firebase: { sign_in_provider: 'custom' },
    });
    const rejected = await runAuthentication('Bearer arbitrary-custom-token');
    expect(rejected.nextError).toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(rejected.req.authContext).toBeUndefined();
  });

  it('rejects invalid tokens and non-Google Firebase sessions', async () => {
    verifyIdToken.mockRejectedValueOnce(new Error('invalid token'));
    const invalid = await runAuthentication('Bearer invalid');
    expect(invalid.nextError).toMatchObject({ code: 'AUTH_REQUIRED' });

    verifyIdToken.mockResolvedValueOnce({ uid: 'non-google-user', firebase: { sign_in_provider: 'password' } });
    const nonGoogleUser = await runAuthentication('Bearer signed-non-google-token');
    expect(nonGoogleUser.nextError).toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(nonGoogleUser.req.authContext).toBeUndefined();
  });
});
