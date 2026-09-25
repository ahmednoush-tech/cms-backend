import { BadRequestException } from '@nestjs/common';
import { ZatcaQrEncoder } from './zatca-qr-encoder';

/**
 * Manually decodes a TLV byte buffer back into {tag, value} pairs
 * — used to verify ZatcaQrEncoder's output byte-for-byte, rather
 * than just trusting it "looks like" a valid base64 string. Given
 * this encodes a legally-required field on a real tax invoice,
 * asserting only "it doesn't throw" would not be enough rigor.
 */
function decodeTlv(base64: string): Array<{ tag: number; value: string }> {
  const buffer = Buffer.from(base64, 'base64');
  const result: Array<{ tag: number; value: string }> = [];
  let offset = 0;
  while (offset < buffer.length) {
    const tag = buffer[offset];
    const length = buffer[offset + 1];
    const value = buffer.subarray(offset + 2, offset + 2 + length).toString('utf-8');
    result.push({ tag, value });
    offset += 2 + length;
  }
  return result;
}

describe('ZatcaQrEncoder', () => {
  const validInput = {
    sellerName: 'Arkan Integrated Systems',
    vatRegistrationNumber: '300000000000003',
    invoiceTimestamp: new Date('2026-06-15T14:30:00.000Z'),
    invoiceTotal: '1150.00',
    vatTotal: '150.00',
  };

  it('produces a valid base64 string', () => {
    const qr = ZatcaQrEncoder.encode(validInput);
    expect(() => Buffer.from(qr, 'base64')).not.toThrow();
  });

  it('decodes back to exactly 5 tags, in the correct order (1-5), with the exact original values', () => {
    const qr = ZatcaQrEncoder.encode(validInput);
    const decoded = decodeTlv(qr);

    expect(decoded).toHaveLength(5);
    expect(decoded.map((d) => d.tag)).toEqual([1, 2, 3, 4, 5]);
    expect(decoded[0].value).toBe('Arkan Integrated Systems');
    expect(decoded[1].value).toBe('300000000000003');
    expect(decoded[2].value).toBe('2026-06-15T14:30:00.000Z');
    expect(decoded[3].value).toBe('1150.00');
    expect(decoded[4].value).toBe('150.00');
  });

  it('correctly round-trips a UTF-8 (Arabic) seller name — byte length differs from character count', () => {
    const qr = ZatcaQrEncoder.encode({ ...validInput, sellerName: 'شركة أركان المتكاملة' });
    const decoded = decodeTlv(qr);
    expect(decoded[0].value).toBe('شركة أركان المتكاملة');
  });

  it('rejects an empty or missing seller name', () => {
    expect(() => ZatcaQrEncoder.encode({ ...validInput, sellerName: '' })).toThrow(BadRequestException);
    expect(() => ZatcaQrEncoder.encode({ ...validInput, sellerName: '   ' })).toThrow(BadRequestException);
  });

  it('rejects a VAT number that is not exactly 15 digits', () => {
    expect(() => ZatcaQrEncoder.encode({ ...validInput, vatRegistrationNumber: '12345' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      ZatcaQrEncoder.encode({ ...validInput, vatRegistrationNumber: '30000000000000A' }),
    ).toThrow(BadRequestException);
    expect(() => ZatcaQrEncoder.encode({ ...validInput, vatRegistrationNumber: '' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a field whose UTF-8 byte length exceeds the 255-byte single-length-byte limit', () => {
    const tooLong = 'A'.repeat(256);
    expect(() => ZatcaQrEncoder.encode({ ...validInput, sellerName: tooLong })).toThrow(BadRequestException);
  });

  it('produces a different QR string for a different invoice total (no accidental caching/reuse)', () => {
    const qr1 = ZatcaQrEncoder.encode(validInput);
    const qr2 = ZatcaQrEncoder.encode({ ...validInput, invoiceTotal: '2300.00' });
    expect(qr1).not.toBe(qr2);
  });
});

/** Same principle as decodeTlv() above, but keeps values as raw Buffers rather than forcing UTF-8 decoding — Tags 6-9 are binary (a hash, a signature, a public key), and coercing them through UTF-8 would silently corrupt bytes that don't happen to form valid UTF-8 sequences. */
function decodeTlvBinary(base64: string): Array<{ tag: number; value: Buffer }> {
  const buffer = Buffer.from(base64, 'base64');
  const result: Array<{ tag: number; value: Buffer }> = [];
  let offset = 0;
  while (offset < buffer.length) {
    const tag = buffer[offset];
    const length = buffer[offset + 1];
    const value = buffer.subarray(offset + 2, offset + 2 + length);
    result.push({ tag, value: Buffer.from(value) });
    offset += 2 + length;
  }
  return result;
}

describe('ZatcaQrEncoder.encodePhase2', () => {
  const validPhase2Input = {
    sellerName: 'Acme Trading Co.',
    vatRegistrationNumber: '300000000000003',
    invoiceTimestamp: new Date('2026-06-15T14:30:00Z'),
    invoiceTotal: '1150.00',
    vatTotal: '150.00',
    invoiceHash: Buffer.from('a1b2c3d4e5f6', 'hex'),
    digitalSignature: Buffer.alloc(64, 7), // 64 bytes, matching real secp256k1 IEEE-P1363 signature length
    publicKey: Buffer.from('04' + 'aa'.repeat(64), 'hex'), // uncompressed EC point shape (0x04 prefix + 64 bytes)
    certificateSignature: Buffer.alloc(70, 9),
  };

  it('produces all 9 tags, in order, with Tags 1-5 matching Phase 1 encoding exactly', () => {
    const qr = ZatcaQrEncoder.encodePhase2(validPhase2Input);
    const decoded = decodeTlvBinary(qr);

    expect(decoded.map((d) => d.tag)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(decoded[0].value.toString('utf-8')).toBe('Acme Trading Co.');
    expect(decoded[1].value.toString('utf-8')).toBe('300000000000003');
  });

  it('preserves binary tag content byte-for-byte (no UTF-8 corruption of non-text bytes)', () => {
    const qr = ZatcaQrEncoder.encodePhase2(validPhase2Input);
    const decoded = decodeTlvBinary(qr);

    const hashTag = decoded.find((d) => d.tag === 6)!;
    const sigTag = decoded.find((d) => d.tag === 7)!;
    const pubKeyTag = decoded.find((d) => d.tag === 8)!;
    const certSigTag = decoded.find((d) => d.tag === 9)!;

    expect(hashTag.value.equals(validPhase2Input.invoiceHash)).toBe(true);
    expect(sigTag.value.equals(validPhase2Input.digitalSignature)).toBe(true);
    expect(pubKeyTag.value.equals(validPhase2Input.publicKey)).toBe(true);
    expect(certSigTag.value.equals(validPhase2Input.certificateSignature)).toBe(true);
  });

  it('still enforces the Phase 1 seller-name/VAT-number validation', () => {
    expect(() => ZatcaQrEncoder.encodePhase2({ ...validPhase2Input, sellerName: '' })).toThrow(BadRequestException);
    expect(() => ZatcaQrEncoder.encodePhase2({ ...validPhase2Input, vatRegistrationNumber: '123' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects an empty cryptographic field rather than silently encoding a zero-length tag (a placeholder value would look valid but sign nothing)', () => {
    expect(() => ZatcaQrEncoder.encodePhase2({ ...validPhase2Input, invoiceHash: Buffer.alloc(0) })).toThrow(
      BadRequestException,
    );
    expect(() => ZatcaQrEncoder.encodePhase2({ ...validPhase2Input, digitalSignature: Buffer.alloc(0) })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a binary field exceeding the 255-byte TLV length limit', () => {
    expect(() =>
      ZatcaQrEncoder.encodePhase2({ ...validPhase2Input, certificateSignature: Buffer.alloc(300, 1) }),
    ).toThrow(BadRequestException);
  });
});
