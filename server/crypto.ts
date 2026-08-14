import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { getEncryptionConfig } from './config';

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
  version: string;
}

export function encryptSecret(value: string): EncryptedSecret {
  const { key, version } = getEncryptionConfig();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    version,
  };
}

export function decryptSecret(secret: EncryptedSecret): string {
  const { keys } = getEncryptionConfig();
  const key = keys.get(secret.version);
  if (!key) throw new Error(`No hay una clave de cifrado disponible para la versión ${secret.version}.`);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(secret.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(secret.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
