import type { ApiError } from '../src/types';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiError['code'],
    message: string,
    public readonly recoverable = false,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errors = {
  configuration(message: string) {
    return new AppError(503, 'CONFIGURATION_ERROR', message, true);
  },
  authentication(message = 'Necesitas iniciar sesión para continuar.') {
    return new AppError(401, 'AUTH_REQUIRED', message, true);
  },
  reauthorization(message = 'Necesitamos volver a conectar tu cuenta de Google.') {
    return new AppError(401, 'GOOGLE_REAUTH_REQUIRED', message, true);
  },
  sheetNotFound(message = 'No encontramos tu archivo financiero.') {
    return new AppError(404, 'SHEET_NOT_FOUND', message, true);
  },
  schema(message: string) {
    return new AppError(422, 'SHEET_SCHEMA_INVALID', message, true);
  },
  validation(message: string) {
    return new AppError(422, 'VALIDATION_FAILED', message, true);
  },
  conflict(message: string) {
    return new AppError(409, 'CONFLICT', message, true);
  },
  rateLimited(message = 'Hiciste demasiadas solicitudes. Espera un momento y vuelve a intentarlo.') {
    return new AppError(429, 'RATE_LIMITED', message, true);
  },
  google(message: string, cause?: unknown) {
    return new AppError(502, 'GOOGLE_ERROR', message, true, cause);
  },
  internal(message = 'No pudimos completar la operación. Inténtalo de nuevo.') {
    return new AppError(500, 'INTERNAL', message, true);
  },
};

export function toApiError(error: unknown): ApiError {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message, recoverable: error.recoverable };
  }
  return { code: 'INTERNAL', message: 'No pudimos completar la operación. Inténtalo de nuevo.', recoverable: true };
}
