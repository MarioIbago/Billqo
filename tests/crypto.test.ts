import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from '../server/crypto';
import { getOwnerKey } from '../server/config';

const keyV1 = Buffer.alloc(32, 7).toString('base64');
const keyV2 = Buffer.alloc(32, 9).toString('base64');

function setEncryptionEnvironment(key: string, version: string, legacy = '{}') {
  process.env.TOKEN_ENCRYPTION_KEY = key;
  process.env.TOKEN_ENCRYPTION_KEY_VERSION = version;
  process.env.TOKEN_ENCRYPTION_LEGACY_KEYS = legacy;
}

describe('AES-256-GCM token encryption', () => {
  it('round-trips a refresh token without keeping plaintext in the stored payload', () => {
    setEncryptionEnvironment(keyV1, 'v1');
    const encrypted = encryptSecret('refresh-token-private');

    expect(encrypted.version).toBe('v1');
    expect(encrypted.ciphertext).not.toContain('refresh-token-private');
    expect(decryptSecret(encrypted)).toBe('refresh-token-private');
  });

  it('rejects a ciphertext whose authentication tag was modified', () => {
    setEncryptionEnvironment(keyV1, 'v1');
    const encrypted = encryptSecret('refresh-token-private');
    encrypted.authTag = Buffer.alloc(16, 0).toString('base64');

    expect(() => decryptSecret(encrypted)).toThrow();
  });

  it('can decrypt a historic version while the key ring explicitly retains it', () => {
    setEncryptionEnvironment(keyV1, 'v1');
    const encrypted = encryptSecret('old-token');
    setEncryptionEnvironment(keyV2, 'v2', JSON.stringify({ v1: keyV1 }));

    expect(decryptSecret(encrypted)).toBe('old-token');
  });

  it('keeps the Drive app-property identifier stable across encryption-key rotation', () => {
    process.env.FIREBASE_ADMIN_PROJECT_ID = 'stable-project';
    delete process.env.GOOGLE_SHEET_OWNER_KEY;
    setEncryptionEnvironment(keyV1, 'v1');
    const beforeRotation = getOwnerKey('firebase-user');
    setEncryptionEnvironment(keyV2, 'v2');

    expect(getOwnerKey('firebase-user')).toBe(beforeRotation);
  });
});
