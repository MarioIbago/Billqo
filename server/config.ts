import { createHash } from 'node:crypto';
import { errors } from './errors';

export const GOOGLE_DATA_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/drive.file',
] as const;

export const GOOGLE_OAUTH_CALLBACK_PATH = '/api/google/oauth/callback';

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function getAppUrl(): string {
  const configuredUrl = env('APP_URL');
  if (!configuredUrl) {
    throw errors.configuration('Falta APP_URL en el servidor. Configura la URL base exacta del entorno.');
  }

  let parsed: URL;
  try {
    parsed = new URL(configuredUrl);
  } catch {
    throw errors.configuration('APP_URL debe ser una URL absoluta vÃ¡lida, por ejemplo https://billqo.vercel.app.');
  }

  if (parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw errors.configuration('APP_URL debe contener solamente esquema, host y puerto; no incluyas ruta, credenciales, query ni hash.');
  }

  return parsed.origin;
}

export function getGoogleOAuthConfig() {
  const clientId = env('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = env('GOOGLE_OAUTH_CLIENT_SECRET');
  const redirectUri = env('GOOGLE_OAUTH_REDIRECT_URI');
  if (!clientId || !clientSecret || !redirectUri) {
    throw errors.configuration('Falta configurar Google OAuth en el servidor. Revisa las variables de entorno.');
  }
  const expectedRedirectUri = `${getAppUrl()}${GOOGLE_OAUTH_CALLBACK_PATH}`;
  if (redirectUri !== expectedRedirectUri) {
    throw errors.configuration(`GOOGLE_OAUTH_REDIRECT_URI debe coincidir exactamente con ${expectedRedirectUri}.`);
  }
  return { clientId, clientSecret, redirectUri };
}

/**
 * Fails fast at runtime when the server cannot securely authenticate Firebase
 * users or perform the server-side Google OAuth code flow. Secrets are never
 * returned or written to logs by this validation.
 */
export function validateRuntimeConfiguration(): void {
  getGoogleOAuthConfig();
  getFirebaseAdminConfig();
  getEncryptionConfig();
}

export function getFirebaseAdminConfig() {
  const projectId = env('FIREBASE_ADMIN_PROJECT_ID');
  const clientEmail = env('FIREBASE_ADMIN_CLIENT_EMAIL');
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw errors.configuration('Falta configurar Firebase Admin en el servidor. Revisa las variables de entorno.');
  }
  const databaseId = env('FIREBASE_ADMIN_DATABASE_ID') ?? '(default)';
  return { projectId, clientEmail, privateKey, databaseId };
}

export function getEncryptionConfig() {
  const encodedKey = env('TOKEN_ENCRYPTION_KEY');
  const version = env('TOKEN_ENCRYPTION_KEY_VERSION') ?? 'v1';
  if (!encodedKey) {
    throw errors.configuration('Falta la clave de cifrado de tokens en el servidor.');
  }
  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32) {
    throw errors.configuration('TOKEN_ENCRYPTION_KEY debe contener una clave base64 de 32 bytes.');
  }
  const keys = new Map<string, Buffer>([[version, key]]);
  const legacyValue = env('TOKEN_ENCRYPTION_LEGACY_KEYS');
  if (legacyValue) {
    let parsed: unknown;
    try { parsed = JSON.parse(legacyValue); } catch { throw errors.configuration('TOKEN_ENCRYPTION_LEGACY_KEYS debe ser un objeto JSON válido.'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw errors.configuration('TOKEN_ENCRYPTION_LEGACY_KEYS debe ser un objeto de versión a clave base64.');
    }
    for (const [legacyVersion, legacyKey] of Object.entries(parsed)) {
      if (typeof legacyKey !== 'string') throw errors.configuration('Cada clave histórica debe ser una cadena base64.');
      const decoded = Buffer.from(legacyKey, 'base64');
      if (decoded.length !== 32) throw errors.configuration(`La clave histórica ${legacyVersion} no tiene 32 bytes.`);
      keys.set(legacyVersion, decoded);
    }
  }
  return { key, version, keys };
}

export function getFinancialSheetTitle(): string {
  return env('GOOGLE_SHEET_TITLE') ?? 'Billqo - Mis Finanzas';
}

export function getOwnerKey(uid: string): string {
  // This identifier must survive refresh-token encryption key rotation so a reconnect
  // can discover the same user-owned Sheet. It is only a Drive appProperty, never auth.
  const material = `${env('GOOGLE_SHEET_OWNER_KEY') ?? env('GOOGLE_CLOUD_PROJECT_ID') ?? env('FIREBASE_ADMIN_PROJECT_ID') ?? 'unconfigured'}:${uid}`;
  return createHash('sha256').update(material).digest('hex');
}
