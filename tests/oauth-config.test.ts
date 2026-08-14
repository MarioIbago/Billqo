import { afterEach, describe, expect, it, vi } from 'vitest';
import { GOOGLE_DATA_SCOPES, getAppUrl, getGoogleOAuthConfig } from '../server/config';

function configureOAuthEnvironment(overrides: Record<string, string | undefined> = {}): void {
  const values = {
    APP_URL: 'http://127.0.0.1:3001',
    GOOGLE_OAUTH_CLIENT_ID: 'test-client.apps.googleusercontent.com',
    GOOGLE_OAUTH_CLIENT_SECRET: 'test-secret',
    GOOGLE_OAUTH_REDIRECT_URI: 'http://127.0.0.1:3001/api/google/oauth/callback',
    ...overrides,
  };
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value ?? '');
}

afterEach(() => vi.unstubAllEnvs());

describe('Google OAuth runtime configuration', () => {
  it('builds the canonical application origin without a trailing slash', () => {
    configureOAuthEnvironment({ APP_URL: 'https://billqo.vercel.app/' });
    expect(getAppUrl()).toBe('https://billqo.vercel.app');
  });

  it('requires an explicit APP_URL instead of silently choosing localhost', () => {
    configureOAuthEnvironment({ APP_URL: undefined });
    expect(() => getAppUrl()).toThrow('Falta APP_URL');
  });

  it('rejects an OAuth callback that differs even by a trailing slash', () => {
    configureOAuthEnvironment({
      GOOGLE_OAUTH_REDIRECT_URI: 'http://127.0.0.1:3001/api/google/oauth/callback/',
    });
    expect(() => getGoogleOAuthConfig()).toThrow('debe coincidir exactamente');
  });

  it('accepts the exact local callback configured for the server', () => {
    configureOAuthEnvironment();
    expect(getGoogleOAuthConfig().redirectUri).toBe('http://127.0.0.1:3001/api/google/oauth/callback');
  });

  it('requests only the file-scoped Drive permission for Sheets data', () => {
    expect(GOOGLE_DATA_SCOPES).toEqual([
      'openid',
      'email',
      'https://www.googleapis.com/auth/drive.file',
    ]);
  });
});
