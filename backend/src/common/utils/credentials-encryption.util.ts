import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derives a fixed-length key from CREDENTIALS_ENCRYPTION_KEY via
 * scrypt rather than using the raw env var bytes directly — this
 * tolerates an operator setting that env var to any passphrase
 * length/format, not just an exact 32-byte hex string.
 */
function deriveKey(): Buffer {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY is not set — cannot encrypt or decrypt stored credentials.');
  }
  return scryptSync(secret, 'credentials-encryption-salt', KEY_LENGTH);
}

/** Returns `iv:authTag:ciphertext`, all hex-encoded, as a single stored string. */
export function encryptCredential(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptCredential(stored: string): string {
  const key = deriveKey();
  const [ivHex, authTagHex, ciphertextHex] = stored.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Stored credential is malformed and cannot be decrypted.');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
