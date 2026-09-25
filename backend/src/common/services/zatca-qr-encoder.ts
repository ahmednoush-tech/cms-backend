import { BadRequestException } from '@nestjs/common';

/**
 * ZATCA Phase 1 (Generation Phase) QR code — Tags 1-5 only.
 *
 * Confirmed against ZATCA's own published spec ("Guide to
 * Developed FATOORA Compliant QR Code") and multiple current
 * third-party implementation guides: for a Simplified Tax
 * Invoice not yet onboarded to Phase 2 Integration, the QR must
 * be a Base64-encoded, Tag-Length-Value byte sequence containing
 * exactly these five fields, in this order:
 *
 *   Tag 1: Seller's name
 *   Tag 2: VAT registration number (15 digits)
 *   Tag 3: Timestamp of the invoice (ISO 8601, date AND time)
 *   Tag 4: Invoice total (with VAT), as a plain decimal string
 *   Tag 5: VAT total, as a plain decimal string
 *
 * Each TLV entry is [1 tag byte][1 length byte][value bytes,
 * UTF-8 encoded] — the single length byte is why any one field's
 * UTF-8 byte length must stay under 256; this is enforced below
 * rather than silently truncated, since silently corrupting a
 * legal document's QR code is worse than failing loudly.
 *
 * DELIBERATELY DOES NOT attempt Phase 2 (Integration) tags 6-9 —
 * those require a Cryptographic Stamp Identifier issued by ZATCA
 * through their own onboarding process (a real account, OTP, and
 * certificate exchange), which cannot be produced or simulated
 * here. A business only needs Phase 2 once ZATCA has notified
 * them of their integration wave (rolled out by revenue
 * threshold) — until then, Phase 1 (this encoder) is the correct
 * and sufficient legal requirement.
 */
export interface ZatcaPhase1Input {
  sellerName: string;
  vatRegistrationNumber: string;
  /** The precise moment of issuance (date AND time) — not just the invoice's business date. */
  invoiceTimestamp: Date;
  /** Invoice total INCLUDING VAT, e.g. 1150.00 */
  invoiceTotal: string;
  /** VAT total only, e.g. 150.00 */
  vatTotal: string;
}

/**
 * Adds ZATCA Phase 2 (Integration Phase) Tags 6-9 on top of the
 * five Phase 1 fields. UNVERIFIED against a live ZATCA endpoint —
 * see zatca-crypto.service.ts's file comment for the general
 * disclosure that applies to this whole feature. Tag byte formats
 * (raw signature bytes vs base64-of-bytes) follow ZATCA's
 * published QR code guide as best understood; confirm against a
 * real Compliance CSID response before production use — Tag 9 in
 * particular (the CA's signature over the public key) can only be
 * correctly populated once ZATCA has actually issued a
 * certificate, since it's extracted FROM that certificate, not
 * computed locally.
 */
export interface ZatcaPhase2Input extends ZatcaPhase1Input {
  /** Raw SHA-256 hash bytes of the canonicalized invoice XML (NOT base64-encoded here — encodeTlv below handles the byte-level TLV framing; pass the raw digest bytes). */
  invoiceHash: Buffer;
  /** Raw ECDSA signature bytes (IEEE-P1363 r||s, 64 bytes for secp256k1) over the invoice hash — see ZatcaCryptoService.signXml(). */
  digitalSignature: Buffer;
  /** Raw DER-encoded ECDSA public key bytes (SPKI format, stripped of PEM headers) belonging to the certificate that signed this invoice. */
  publicKey: Buffer;
  /** Raw bytes of the CA's (ZATCA's) signature over the public key — extracted from the issued certificate's own signature field, not computed by this application. */
  certificateSignature: Buffer;
}

const MAX_FIELD_BYTES = 255;

export class ZatcaQrEncoder {
  static encode(input: ZatcaPhase1Input): string {
    if (!input.sellerName?.trim()) {
      throw new BadRequestException('ZATCA QR requires a non-empty seller name — configure it in Finance Settings.');
    }
    if (!/^\d{15}$/.test(input.vatRegistrationNumber ?? '')) {
      throw new BadRequestException(
        'ZATCA QR requires a 15-digit VAT registration number — configure it in Finance Settings.',
      );
    }

    const fields: Array<[number, string]> = [
      [1, input.sellerName],
      [2, input.vatRegistrationNumber],
      [3, input.invoiceTimestamp.toISOString()],
      [4, input.invoiceTotal],
      [5, input.vatTotal],
    ];

    const buffers = fields.map(([tag, value]) => this.encodeTlv(tag, value));
    return Buffer.concat(buffers).toString('base64');
  }

  /** Phase 2 — the Phase 1 fields (Tags 1-5) plus the four cryptographic tags (6-9). Throws the same Phase-1 validation as encode() before adding the extra tags. */
  static encodePhase2(input: ZatcaPhase2Input): string {
    if (!input.sellerName?.trim()) {
      throw new BadRequestException('ZATCA QR requires a non-empty seller name — configure it in Finance Settings.');
    }
    if (!/^\d{15}$/.test(input.vatRegistrationNumber ?? '')) {
      throw new BadRequestException(
        'ZATCA QR requires a 15-digit VAT registration number — configure it in Finance Settings.',
      );
    }
    for (const [label, buf] of [
      ['invoiceHash', input.invoiceHash],
      ['digitalSignature', input.digitalSignature],
      ['publicKey', input.publicKey],
      ['certificateSignature', input.certificateSignature],
    ] as const) {
      if (!buf || buf.length === 0) {
        throw new BadRequestException(`ZATCA Phase 2 QR requires a non-empty ${label} — this must come from a completed ZATCA onboarding and a real signed invoice, not a placeholder.`);
      }
    }

    const stringBuffers = [
      this.encodeTlv(1, input.sellerName),
      this.encodeTlv(2, input.vatRegistrationNumber),
      this.encodeTlv(3, input.invoiceTimestamp.toISOString()),
      this.encodeTlv(4, input.invoiceTotal),
      this.encodeTlv(5, input.vatTotal),
    ];
    const binaryBuffers = [
      this.encodeTlvBytes(6, input.invoiceHash),
      this.encodeTlvBytes(7, input.digitalSignature),
      this.encodeTlvBytes(8, input.publicKey),
      this.encodeTlvBytes(9, input.certificateSignature),
    ];

    return Buffer.concat([...stringBuffers, ...binaryBuffers]).toString('base64');
  }

  private static encodeTlv(tag: number, value: string): Buffer {
    const valueBytes = Buffer.from(value, 'utf-8');
    if (valueBytes.length > MAX_FIELD_BYTES) {
      throw new BadRequestException(
        `ZATCA QR field (tag ${tag}) is ${valueBytes.length} bytes, exceeding the 255-byte single-length-byte limit the TLV format allows.`,
      );
    }
    return Buffer.concat([Buffer.from([tag]), Buffer.from([valueBytes.length]), valueBytes]);
  }

  private static encodeTlvBytes(tag: number, value: Buffer): Buffer {
    if (value.length > MAX_FIELD_BYTES) {
      throw new BadRequestException(
        `ZATCA QR field (tag ${tag}) is ${value.length} bytes, exceeding the 255-byte single-length-byte limit the TLV format allows.`,
      );
    }
    return Buffer.concat([Buffer.from([tag]), Buffer.from([value.length]), value]);
  }
}
