import type { RequestHandler } from 'express';
import type { ApiError } from '../src/types';

export const MAX_TRANSACTION_TEXT_LENGTH = 200;
export const MAX_TRANSACTION_AMOUNT = 999_999_999_999.99;

const forbiddenControlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const singleLineBreaks = /[\r\n]/;
const forbiddenObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const currencyCodePattern = /^[A-Z]{3}$/;
const dateFormatPattern = /^(DD|MM|YYYY)([\/.\-])(DD|MM|YYYY)\2(DD|MM|YYYY)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasForbiddenObjectKey(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) => forbiddenObjectKeys.has(key));
}

function validateString(
  value: unknown,
  label: string,
  maxLength: number,
  options: { required?: boolean; singleLine?: boolean } = {},
): string | undefined {
  if (value === undefined || value === null) {
    return options.required ? `${label} es obligatorio.` : undefined;
  }
  if (typeof value !== 'string') return `${label} no tiene un formato válido.`;
  if (value.length > maxLength) return `${label} no puede superar ${maxLength} caracteres.`;
  if (options.required && !value.trim()) return `${label} es obligatorio.`;
  if (forbiddenControlCharacters.test(value)) return `${label} contiene caracteres no permitidos.`;
  if (options.singleLine && singleLineBreaks.test(value)) return `${label} debe escribirse en una sola línea.`;
  return undefined;
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

function validIanaTimezone(value: string): boolean {
  if (value.length < 1 || value.length > 80 || forbiddenControlCharacters.test(value) || singleLineBreaks.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function validDateFormat(value: string): boolean {
  const match = dateFormatPattern.exec(value);
  if (!match) return false;
  const tokens = [match[1], match[3], match[4]];
  return new Set(tokens).size === 3 && tokens.includes('DD') && tokens.includes('MM') && tokens.includes('YYYY');
}

function validationResponse(res: Parameters<RequestHandler>[1], message: string): void {
  const body: ApiError = {
    code: 'VALIDATION_FAILED',
    message,
    recoverable: true,
  };
  res.status(400).json({ error: body });
}

/**
 * Defense-in-depth before the main Zod transaction contract.
 * This deliberately rejects malformed primitive types and hostile control
 * characters without changing legitimate Unicode financial descriptions.
 */
export function transactionPayloadIssue(value: unknown): string | undefined {
  if (!isRecord(value)) return 'Los datos del movimiento no tienen un formato válido.';
  if (hasForbiddenObjectKey(value)) return 'Los datos del movimiento contienen campos no permitidos.';

  if (typeof value.amount !== 'number' || !Number.isFinite(value.amount) || value.amount <= 0 || value.amount > MAX_TRANSACTION_AMOUNT) {
    return `El monto debe ser un número mayor que cero y menor o igual a ${MAX_TRANSACTION_AMOUNT}.`;
  }

  const descriptionIssue = validateString(
    value.description,
    'La descripción',
    MAX_TRANSACTION_TEXT_LENGTH,
    { required: true, singleLine: true },
  );
  if (descriptionIssue) return descriptionIssue;

  const notesIssue = validateString(value.notes, 'Las notas', MAX_TRANSACTION_TEXT_LENGTH);
  if (notesIssue) return notesIssue;

  const categoryIssue = validateString(value.category, 'La categoría', 120, { required: true, singleLine: true });
  if (categoryIssue) return categoryIssue;
  const categoryIdIssue = validateString(value.categoryId, 'El identificador de categoría', 100, { singleLine: true });
  if (categoryIdIssue) return categoryIdIssue;
  const accountIssue = validateString(value.account, 'La cuenta', 120, { singleLine: true });
  if (accountIssue) return accountIssue;

  if (typeof value.date !== 'string' || !validIsoDate(value.date)) return 'La fecha no tiene un formato válido.';

  if (value.tags !== undefined) {
    if (!Array.isArray(value.tags) || value.tags.length > 20) return 'Las etiquetas no tienen un formato válido.';
    for (const tag of value.tags) {
      const issue = validateString(tag, 'Una etiqueta', 60, { required: true, singleLine: true });
      if (issue) return issue;
    }
  }

  return undefined;
}

export function preferencePayloadIssue(value: unknown): string | undefined {
  if (!isRecord(value)) return 'La configuración no tiene un formato válido.';
  if (hasForbiddenObjectKey(value)) return 'La configuración contiene campos no permitidos.';

  const allowedKeys = new Set(['expectedUpdatedAt', 'currency', 'dateFormat', 'timezone', 'monthlyBudget']);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return 'La configuración contiene campos no permitidos.';

  if (typeof value.expectedUpdatedAt !== 'string' || !validIsoTimestamp(value.expectedUpdatedAt)) {
    return 'La versión de la configuración no es válida.';
  }

  let changes = 0;
  if (value.currency !== undefined) {
    changes += 1;
    if (typeof value.currency !== 'string' || !currencyCodePattern.test(value.currency)) {
      return 'La moneda debe usar un código ISO de tres letras mayúsculas.';
    }
  }
  if (value.dateFormat !== undefined) {
    changes += 1;
    if (typeof value.dateFormat !== 'string' || !validDateFormat(value.dateFormat)) {
      return 'El formato de fecha no es válido.';
    }
  }
  if (value.timezone !== undefined) {
    changes += 1;
    if (typeof value.timezone !== 'string' || !validIanaTimezone(value.timezone)) {
      return 'La zona horaria no es válida.';
    }
  }
  if (value.monthlyBudget !== undefined) {
    changes += 1;
    if (typeof value.monthlyBudget !== 'number' || !Number.isFinite(value.monthlyBudget) || value.monthlyBudget < 0 || value.monthlyBudget > MAX_TRANSACTION_AMOUNT) {
      return 'El presupuesto mensual debe ser un número válido no negativo.';
    }
  }

  if (changes === 0) return 'Envía al menos una preferencia válida.';
  return undefined;
}

export const hardenTransactionInput: RequestHandler = (req, res, next) => {
  const candidate = req.method === 'PATCH' && isRecord(req.body) ? req.body.transaction : req.body;
  if (req.method === 'DELETE') {
    next();
    return;
  }

  const issue = transactionPayloadIssue(candidate);
  if (!issue) {
    next();
    return;
  }
  validationResponse(res, issue);
};

export const hardenPreferencesInput: RequestHandler = (req, res, next) => {
  const issue = preferencePayloadIssue(req.body);
  if (!issue) {
    next();
    return;
  }
  validationResponse(res, issue);
};
