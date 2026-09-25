import { encryptCredential, decryptCredential } from './credentials-encryption.util';

describe('credentials-encryption.util', () => {
  beforeEach(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-master-key-12345';
  });

  it('round-trips a plaintext value correctly', () => {
    const original = 'my-super-secret-client-secret-abc123';
    const encrypted = encryptCredential(original);
    expect(decryptCredential(encrypted)).toBe(original);
  });

  it('produces different ciphertext each time for the same plaintext (random IV)', () => {
    const original = 'same-secret-every-time';
    const encrypted1 = encryptCredential(original);
    const encrypted2 = encryptCredential(original);
    expect(encrypted1).not.toBe(encrypted2);
    expect(decryptCredential(encrypted1)).toBe(original);
    expect(decryptCredential(encrypted2)).toBe(original);
  });

  it('throws when decrypting with the wrong key', () => {
    const encrypted = encryptCredential('some-secret');
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'a-completely-different-key';
    expect(() => decryptCredential(encrypted)).toThrow();
  });

  it('throws when the ciphertext has been tampered with (GCM auth tag catches it)', () => {
    const encrypted = encryptCredential('some-secret');
    const [iv, authTag, ciphertext] = encrypted.split(':');
    const tampered = `${iv}:${authTag}:${ciphertext.slice(0, -2)}00`;
    expect(() => decryptCredential(tampered)).toThrow();
  });

  it('throws a clear error when CREDENTIALS_ENCRYPTION_KEY is not set', () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    expect(() => encryptCredential('anything')).toThrow(/CREDENTIALS_ENCRYPTION_KEY/);
  });

  it('throws when the stored value is malformed (not the expected iv:authTag:ciphertext shape)', () => {
    expect(() => decryptCredential('not-a-valid-stored-format')).toThrow(/malformed/);
  });
});
