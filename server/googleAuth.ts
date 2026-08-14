import { createHash, randomBytes } from 'node:crypto';
import { google } from 'googleapis';
import { CodeChallengeMethod } from 'google-auth-library';
import { decryptSecret, encryptSecret } from './crypto';
import { GOOGLE_DATA_SCOPES, getGoogleOAuthConfig } from './config';
import {
  consumeOAuthState,
  createGoogleSignInState,
  createOAuthState,
  getConnection,
  markConnectionStatus,
  saveAuthorizedConnection,
  type OAuthStateRecord,
} from './connectionStore';
import { errors } from './errors';
import { getAdminAuth } from './firebaseAdmin';

interface GoogleIdentity {
  subject: string;
  email: string;
  name?: string;
  picture?: string;
}

interface GoogleAuthorizationResult {
  identity: GoogleIdentity;
  refreshToken?: string;
  scopes: string[];
}

function createClient() {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export type GoogleOAuthClient = ReturnType<typeof createClient>;

function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function isDevelopmentRuntime(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1';
}

function verifyAndLogAuthorizationRequest(
  authorizationUrl: string,
  config: ReturnType<typeof getGoogleOAuthConfig>,
): void {
  const generatedRedirectUri = new URL(authorizationUrl).searchParams.get('redirect_uri');
  if (generatedRedirectUri !== config.redirectUri) {
    throw errors.configuration('La URL OAuth generada no coincide con GOOGLE_OAUTH_REDIRECT_URI.');
  }

  if (!isDevelopmentRuntime()) return;

  // Do not log state, codes, tokens, email addresses, or the complete URL.
  console.info('Google OAuth diagnostics', {
    redirectUri: generatedRedirectUri,
    scopes: [...GOOGLE_DATA_SCOPES],
    environment: process.env.NODE_ENV ?? 'development',
  });
}

function googleProviderErrorReason(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as {
    code?: unknown;
    response?: { data?: { error?: unknown } };
  };
  const providerError = candidate.response?.data?.error;
  if (typeof providerError === 'string') return providerError;
  if (providerError && typeof providerError === 'object') {
    const details = providerError as { errors?: Array<{ reason?: unknown }> };
    const reason = details.errors?.[0]?.reason;
    if (typeof reason === 'string') return reason;
  }
  return typeof candidate.code === 'string' ? candidate.code : undefined;
}

function isOAuthClientConfigurationError(error: unknown): boolean {
  const reason = googleProviderErrorReason(error);
  return reason === 'invalid_client' || reason === 'unauthorized_client';
}

function createAuthorizationUrl(
  state: string,
  challenge: string,
  options: { email?: string; selectAccount?: boolean },
): string {
  const config = getGoogleOAuthConfig();
  const client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
  const authorizationUrl = client.generateAuthUrl({
    access_type: 'offline',
    include_granted_scopes: true,
    // A consent prompt is deliberate: Sheets needs a durable refresh token,
    // while select_account prevents a browser's cached account being selected
    // silently during the initial Billqo sign-in.
    prompt: options.selectAccount ? 'select_account consent' : 'consent',
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: CodeChallengeMethod.S256,
    scope: [...GOOGLE_DATA_SCOPES],
    state,
    ...(options.email ? { login_hint: options.email } : {}),
  });
  verifyAndLogAuthorizationRequest(authorizationUrl, config);
  return authorizationUrl;
}

async function exchangeGoogleAuthorization(
  code: string,
  stateRecord: OAuthStateRecord,
): Promise<GoogleAuthorizationResult> {
  const client = createClient();
  const tokenResponse = await client.getToken({ code, codeVerifier: stateRecord.codeVerifier }).catch((error: unknown): never => {
    if (isOAuthClientConfigurationError(error)) {
      throw errors.configuration('La configuracion de Google OAuth necesita atencion del administrador de Billqo.');
    }
    if (isReauthorizationError(error)) {
      throw errors.reauthorization('La autorizacion de Google expiro o fue rechazada. Intentalo de nuevo.');
    }
    throw errors.google('No pudimos completar la autorizacion con Google. Intentalo de nuevo.');
  });
  const tokens = tokenResponse.tokens;
  if (!tokens.id_token) {
    throw errors.reauthorization('Google no devolvio la identidad necesaria para completar la conexion.');
  }

  const { clientId } = getGoogleOAuthConfig();
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
  const profile = ticket.getPayload();
  if (!profile?.sub || !profile.email || profile.email_verified !== true) {
    throw errors.reauthorization('No pudimos validar la cuenta de Google autorizada.');
  }

  return {
    identity: {
      subject: profile.sub,
      email: profile.email,
      ...(typeof profile.name === 'string' ? { name: profile.name } : {}),
      ...(typeof profile.picture === 'string' ? { picture: profile.picture } : {}),
    },
    refreshToken: tokens.refresh_token ?? undefined,
    scopes: (tokens.scope ?? GOOGLE_DATA_SCOPES.join(' ')).split(' ').filter(Boolean),
  };
}

async function saveGoogleConnection(uid: string, authorization: GoogleAuthorizationResult): Promise<void> {
  await saveAuthorizedConnection(uid, {
    googleSubject: authorization.identity.subject,
    refreshToken: authorization.refreshToken ? encryptSecret(authorization.refreshToken) : undefined,
    scopes: authorization.scopes,
  });
}

function isFirebaseError(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === code);
}

function firebaseUidForGoogleSubject(subject: string): string {
  // Store no raw Google subject in the Firebase uid. The source subject is
  // retained only in the server-owned, access-controlled connection record.
  return `google_${createHash('sha256').update(subject).digest('base64url')}`;
}

async function resolveFirebaseUser(identity: GoogleIdentity): Promise<string> {
  const firebaseAuth = getAdminAuth();
  const profile = {
    email: identity.email,
    emailVerified: true,
    ...(identity.name ? { displayName: identity.name } : {}),
    ...(identity.picture ? { photoURL: identity.picture } : {}),
  };

  try {
    const existing = await firebaseAuth.getUserByEmail(identity.email);
    await firebaseAuth.updateUser(existing.uid, profile);
    return existing.uid;
  } catch (error) {
    if (!isFirebaseError(error, 'auth/user-not-found')) throw error;
  }

  const uid = firebaseUidForGoogleSubject(identity.subject);
  try {
    await firebaseAuth.createUser({ uid, ...profile });
    return uid;
  } catch (error) {
    // A concurrent callback for the same verified Google account can create
    // the user first. Resolve it by email rather than creating another uid.
    if (!isFirebaseError(error, 'auth/email-already-exists') && !isFirebaseError(error, 'auth/uid-already-exists')) throw error;
    const existing = await firebaseAuth.getUserByEmail(identity.email);
    await firebaseAuth.updateUser(existing.uid, profile);
    return existing.uid;
  }
}

/** Start Google sign-in without Firebase's cross-origin redirect helper. */
export async function beginGoogleSignIn(): Promise<string> {
  const { verifier, challenge } = createPkcePair();
  const state = await createGoogleSignInState(verifier);
  return createAuthorizationUrl(state, challenge, { selectAccount: true });
}

/** Start a Sheets reconnect for a user who already has a Firebase session. */
export async function beginGoogleAuthorization(uid: string, email?: string): Promise<string> {
  const { verifier, challenge } = createPkcePair();
  const state = await createOAuthState(uid, email, verifier);
  return createAuthorizationUrl(state, challenge, { email });
}

export async function finishGoogleAuthorization(code: string, state: string): Promise<{ uid: string }> {
  const stateRecord = await consumeOAuthState(state);
  if (stateRecord.purpose !== 'sheets') throw errors.reauthorization();
  const authorization = await exchangeGoogleAuthorization(code, stateRecord);
  if (stateRecord.email && authorization.identity.email.toLowerCase() !== stateRecord.email.toLowerCase()) {
    throw errors.reauthorization('Usa la misma cuenta de Google con la que iniciaste sesion.');
  }
  await saveGoogleConnection(stateRecord.uid, authorization);
  return { uid: stateRecord.uid };
}

/**
 * Completes Google sign-in and issues a Firebase custom token only after the
 * Google ID token and authorization code have been verified on this server.
 */
export async function finishGoogleSignIn(code: string, state: string): Promise<{ uid: string; customToken: string }> {
  const stateRecord = await consumeOAuthState(state);
  if (stateRecord.purpose !== 'sign_in') throw errors.reauthorization();
  const authorization = await exchangeGoogleAuthorization(code, stateRecord);
  const uid = await resolveFirebaseUser(authorization.identity);
  await saveGoogleConnection(uid, authorization);
  const customToken = await getAdminAuth().createCustomToken(uid, { billqoGoogleIdentity: true });
  return { uid, customToken };
}

export async function getAuthorizedGoogleClient(uid: string): Promise<GoogleOAuthClient> {
  const connection = await getConnection(uid);
  if (!connection?.refreshToken) throw errors.reauthorization();
  const client = createClient();
  client.setCredentials({ refresh_token: decryptSecret(connection.refreshToken) });
  client.on('tokens', (tokens) => {
    if (!tokens.refresh_token || !connection.googleSubject) return;
    void saveAuthorizedConnection(uid, {
      googleSubject: connection.googleSubject,
      refreshToken: encryptSecret(tokens.refresh_token),
      scopes: connection.scopes ?? [...GOOGLE_DATA_SCOPES],
    }).catch(() => undefined);
  });
  return client;
}

export async function revokeGoogleAuthorization(uid: string): Promise<void> {
  const connection = await getConnection(uid);
  if (!connection?.refreshToken) return;
  const client = createClient();
  try {
    await client.revokeToken(decryptSecret(connection.refreshToken));
  } catch (error) {
    // A revoked/expired token has already achieved the desired disconnected state.
    if (!isReauthorizationError(error)) throw error;
  }
}

export function isReauthorizationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { response?: { status?: number }; code?: number };
  const code = candidate.response?.status ?? candidate.code;
  const reason = googleProviderErrorReason(error);
  return code === 401
    || reason === 'invalid_grant'
    || reason === 'authError'
    || reason === 'invalidCredentials'
    || reason === 'insufficientPermissions'
    || reason === 'insufficientFilePermissions';
}

export async function markGoogleReauthorizationRequired(uid: string): Promise<void> {
  await markConnectionStatus(uid, 'reauth_required');
}
