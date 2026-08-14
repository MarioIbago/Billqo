import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateAuthUrl: vi.fn(),
  getToken: vi.fn(),
  verifyIdToken: vi.fn(),
  createGoogleSignInState: vi.fn(),
  createOAuthState: vi.fn(),
  consumeOAuthState: vi.fn(),
  getConnection: vi.fn(),
  markConnectionStatus: vi.fn(),
  saveAuthorizedConnection: vi.fn(),
  encryptSecret: vi.fn((value: string) => ({ ciphertext: `encrypted:${value}`, iv: 'iv', authTag: 'tag', version: 'v1' })),
  decryptSecret: vi.fn(),
  getUserByEmail: vi.fn(),
  updateUser: vi.fn(),
  createUser: vi.fn(),
  createCustomToken: vi.fn(),
}));

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: class {
        generateAuthUrl = mocks.generateAuthUrl;
        getToken = mocks.getToken;
        verifyIdToken = mocks.verifyIdToken;
        setCredentials = vi.fn();
        on = vi.fn();
      },
    },
  },
}));

vi.mock('google-auth-library', () => ({
  CodeChallengeMethod: { S256: 'S256' },
}));

vi.mock('../server/config', () => ({
  GOOGLE_DATA_SCOPES: ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'],
  getGoogleOAuthConfig: () => ({
    clientId: 'test-client-id',
    clientSecret: 'server-only-secret',
    redirectUri: 'https://app.example/api/google/oauth/callback',
  }),
}));

vi.mock('../server/crypto', () => ({
  decryptSecret: mocks.decryptSecret,
  encryptSecret: mocks.encryptSecret,
}));

vi.mock('../server/connectionStore', () => ({
  consumeOAuthState: mocks.consumeOAuthState,
  createGoogleSignInState: mocks.createGoogleSignInState,
  createOAuthState: mocks.createOAuthState,
  getConnection: mocks.getConnection,
  markConnectionStatus: mocks.markConnectionStatus,
  saveAuthorizedConnection: mocks.saveAuthorizedConnection,
}));

vi.mock('../server/firebaseAdmin', () => ({
  getAdminAuth: () => ({
    getUserByEmail: mocks.getUserByEmail,
    updateUser: mocks.updateUser,
    createUser: mocks.createUser,
    createCustomToken: mocks.createCustomToken,
  }),
}));

import { beginGoogleSignIn, finishGoogleSignIn } from '../server/googleAuth';

const providerAuthorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2F%2Fapp.example%2Fapi%2Fgoogle%2Foauth%2Fcallback';

describe('server-owned Google sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateAuthUrl.mockReturnValue(providerAuthorizationUrl);
    mocks.createGoogleSignInState.mockResolvedValue('opaque-state');
    mocks.getToken.mockResolvedValue({
      tokens: {
        id_token: 'verified-google-id-token',
        refresh_token: 'long-lived-google-refresh-token',
        scope: 'openid email https://www.googleapis.com/auth/drive.file',
      },
    });
    mocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-subject',
        email: 'person@example.com',
        email_verified: true,
        name: 'Example Person',
        picture: 'https://example.invalid/avatar.png',
      }),
    });
    mocks.getUserByEmail.mockRejectedValue(Object.assign(new Error('not found'), { code: 'auth/user-not-found' }));
    mocks.createUser.mockResolvedValue({});
    mocks.createCustomToken.mockResolvedValue('firebase-custom-token');
  });

  it('starts a PKCE, account-selecting Google authorization without using Firebase redirect helpers', async () => {
    const authorizationUrl = await beginGoogleSignIn();

    expect(authorizationUrl).toBe(providerAuthorizationUrl);
    expect(mocks.createGoogleSignInState).toHaveBeenCalledTimes(1);
    expect(mocks.createGoogleSignInState.mock.calls[0]?.[0]).toEqual(expect.any(String));
    const options = mocks.generateAuthUrl.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(options).toMatchObject({
      access_type: 'offline',
      prompt: 'select_account consent',
      response_type: 'code',
      code_challenge_method: 'S256',
      state: 'opaque-state',
    });
    expect(options.scope).toEqual(['openid', 'email', 'https://www.googleapis.com/auth/drive.file']);
    expect(options).not.toHaveProperty('login_hint');
  });

  it('accepts only a verified Google identity, saves its Drive grant, and mints the marked Firebase session', async () => {
    mocks.consumeOAuthState.mockResolvedValue({ purpose: 'sign_in', codeVerifier: 'pkce-verifier' });

    const result = await finishGoogleSignIn('authorization-code', 'opaque-state');

    expect(result.customToken).toBe('firebase-custom-token');
    expect(result.uid).toMatch(/^google_[A-Za-z0-9_-]+$/);
    expect(mocks.getToken).toHaveBeenCalledWith({ code: 'authorization-code', codeVerifier: 'pkce-verifier' });
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({
      uid: result.uid,
      email: 'person@example.com',
      emailVerified: true,
      displayName: 'Example Person',
    }));
    expect(mocks.saveAuthorizedConnection).toHaveBeenCalledWith(result.uid, expect.objectContaining({
      googleSubject: 'google-subject',
      scopes: ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'],
    }));
    expect(mocks.createCustomToken).toHaveBeenCalledWith(result.uid, { billqoGoogleIdentity: true });
  });

  it('rejects a Sheets reconnect state before exchanging its authorization code', async () => {
    mocks.consumeOAuthState.mockResolvedValue({
      purpose: 'sheets',
      uid: 'existing-user',
      email: 'person@example.com',
      codeVerifier: 'pkce-verifier',
    });

    await expect(finishGoogleSignIn('authorization-code', 'opaque-state')).rejects.toMatchObject({
      code: 'GOOGLE_REAUTH_REQUIRED',
    });
    expect(mocks.getToken).not.toHaveBeenCalled();
    expect(mocks.createCustomToken).not.toHaveBeenCalled();
  });

  it('rejects an ID token whose Google email was not verified', async () => {
    mocks.consumeOAuthState.mockResolvedValue({ purpose: 'sign_in', codeVerifier: 'pkce-verifier' });
    mocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'google-subject', email: 'person@example.com', email_verified: false }),
    });

    await expect(finishGoogleSignIn('authorization-code', 'opaque-state')).rejects.toMatchObject({
      code: 'GOOGLE_REAUTH_REQUIRED',
    });
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.createCustomToken).not.toHaveBeenCalled();
  });
});
