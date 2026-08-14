import type { NextFunction, Request, Response } from 'express';
import { getAdminAuth } from './firebaseAdmin';
import { errors } from './errors';

export interface AuthContext {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  provider?: string;
}

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}

export async function requireFirebaseAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw errors.authentication();

    // Check revocation for every API request. A user who signs out everywhere
    // or whose Firebase session is revoked cannot keep using a cached ID token.
    const decoded = await getAdminAuth().verifyIdToken(header.slice('Bearer '.length), true);
    const provider = decoded.firebase?.sign_in_provider;
    // Initial login exchanges a server-verified Google authorization code for
    // a Firebase custom token. Only custom tokens minted by this server carry
    // this claim; arbitrary custom-provider tokens remain rejected.
    const customGoogleIdentity = provider === 'custom'
      && (decoded as typeof decoded & { billqoGoogleIdentity?: unknown }).billqoGoogleIdentity === true;
    if (provider !== 'google.com' && !customGoogleIdentity) {
      throw errors.authentication('Billqo solo permite iniciar sesión con Google.');
    }
    req.authContext = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      provider: 'google.com',
    };
    next();
  } catch (error) {
    if (!(error instanceof Error && error.name === 'AppError')) {
      const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code ?? 'unknown')
        : 'unknown';
      console.warn('Firebase ID token verification failed', code);
    }
    next(error instanceof Error && error.name === 'AppError' ? error : errors.authentication());
  }
}

export function authenticated(req: Request): AuthContext {
  if (!req.authContext) throw errors.authentication();
  return req.authContext;
}
