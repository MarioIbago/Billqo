import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const { createSupportReport } = vi.hoisted(() => ({ createSupportReport: vi.fn() }));

vi.mock('../server/reports', () => ({ createSupportReport }));

vi.hoisted(() => {
  // The production runtime now requires APP_URL. Keep callback-route tests
  // explicit about their own environment rather than relying on a localhost
  // fallback that the real server must never use.
  process.env.APP_URL = 'http://127.0.0.1:3001';
});

import app from '../server/app';

describe('protected API boundary', () => {
  it('rejects a request without a Firebase bearer token', async () => {
    const response = await request(app).get('/api/connection');
    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({ code: 'AUTH_REQUIRED', recoverable: true });
  });

  it('keeps the one-time Firebase exchange public but empty without its HttpOnly cookie', async () => {
    const response = await request(app).post('/api/auth/firebase-token');
    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(response.headers['cache-control']).toContain('no-store');
    expect(String(response.headers['set-cookie'] ?? '')).toContain('HttpOnly');
  });

  it('never exposes an OAuth callback provider error to the browser', async () => {
    const response = await request(app).get('/api/google/oauth/callback?error=access_denied&state=untrusted');
    expect(response.status).toBe(303);
    expect(response.headers.location).toContain('#/app?google=reauthorization_required');
    expect(response.text).not.toContain('access_denied');
  });

  it('protects the permanent financial-data deletion endpoint', async () => {
    const response = await request(app).delete('/api/financial-data');
    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({ code: 'AUTH_REQUIRED', recoverable: true });
  });

  it('accepts a valid public report without exposing Firestore to the browser', async () => {
    createSupportReport.mockResolvedValue(undefined);

    const response = await request(app)
      .post('/api/reports')
      .send({ category: 'bug', message: 'El botón de sincronizar no responde después de iniciar sesión.', email: 'person@example.com' });

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({ status: 'received' });
    expect(createSupportReport).toHaveBeenCalledWith({
      category: 'bug',
      message: 'El botón de sincronizar no responde después de iniciar sesión.',
      email: 'person@example.com',
    });
  });

  it('does not persist a honeypot report', async () => {
    createSupportReport.mockClear();

    const response = await request(app)
      .post('/api/reports')
      .send({ category: 'other', message: 'Este contenido no debe llegar a la colección.', website: 'https://bot.invalid' });

    expect(response.status).toBe(202);
    expect(createSupportReport).not.toHaveBeenCalled();
  });
});
