import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export interface ZatcaCsrSubject {
  /** ZATCA's specific format: "1-<solutionName>|2-<version>|3-<serialNumber>" — verify the exact template against ZATCA's current onboarding guide; this is a best-effort based on published examples, not independently confirmed against a live portal. */
  commonName: string;
  /** 15-digit VAT registration number — maps to the X.520 organizationIdentifier attribute, confirmed by real OpenSSL execution during development to serialize correctly into the CSR subject. */
  organizationIdentifier: string;
  organizationUnitName: string;
  organizationName: string;
  countryCode: string;
}

/**
 * ZATCA requires the secp256k1 curve specifically (not the more
 * common P-256/secp256r1) — confirmed against ZATCA's published
 * Cryptography Specifications.
 *
 * generateKeyPair / hashXml / signXml / verifyXmlSignature use
 * Node's built-in crypto module and were VERIFIED WORKING by real
 * execution during development: secp256k1 key generation, ECDSA
 * signing with raw r||s IEEE-P1363 encoding (64 bytes, matching
 * ZATCA's QR Tag 7 and XML signature format — NOT the DER
 * encoding Node produces by default), and sign→verify round-
 * tripped correctly.
 *
 * generateCsr uses the system `openssl` CLI (via execFileSync, not
 * a shell string, so there is no shell-injection surface even
 * though all inputs here are server-controlled) rather than a
 * pure-JS ASN.1/PKCS#10 library. This was a deliberate change made
 * DURING development: an initial attempt using node-forge could
 * not be verified at all (this sandbox has no network access to
 * install it), and a hand-inspection of that code turned up
 * dead-end logic that would not have worked. The OpenSSL approach
 * below WAS verified end-to-end by real execution — secp256k1 key
 * generation, and a CSR with a custom organizationIdentifier
 * subject field, both produced and inspected with `openssl req
 * -text -noout`. What is NOT verified: whether ZATCA's CSR
 * template needs additional fields beyond the five here (their
 * guide references further custom fields for invoice-type support
 * flags) — cross-check the current "Onboarding a New Solution
 * Unit" guide before relying on this for a real submission, and
 * confirm `openssl` is present on whatever server actually runs
 * this in production.
 */
@Injectable()
export class ZatcaCryptoService {
  generateKeyPair(): { privateKeyPem: string; publicKeyPem: string } {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp256k1',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    return { privateKeyPem: privateKey as unknown as string, publicKeyPem: publicKey as unknown as string };
  }

  hashXml(canonicalXml: string): string {
    return crypto.createHash('sha256').update(canonicalXml, 'utf-8').digest('base64');
  }

  signXml(canonicalXml: string, privateKeyPem: string): Buffer {
    const sign = crypto.createSign('SHA256');
    sign.update(canonicalXml, 'utf-8');
    sign.end();
    return sign.sign({ key: privateKeyPem, dsaEncoding: 'ieee-p1363' });
  }

  verifyXmlSignature(canonicalXml: string, signature: Buffer, publicKeyPem: string): boolean {
    const verify = crypto.createVerify('SHA256');
    verify.update(canonicalXml, 'utf-8');
    verify.end();
    return verify.verify({ key: publicKeyPem, dsaEncoding: 'ieee-p1363' }, signature);
  }

  /**
   * Shells out to `openssl req -new` with a generated config file.
   * Uses a per-call temp directory (cleaned up in a finally block
   * even on failure) since it briefly writes the PRIVATE KEY to
   * disk — openssl has no way to accept a key via stdin for this
   * operation. execFileSync (not exec/spawn with shell:true) passes
   * arguments as an array, so there is no shell involved to inject
   * into even though every value here is server-generated.
   */
  generateCsr(privateKeyPem: string, subject: ZatcaCsrSubject): string {
    const dir = mkdtempSync(join(tmpdir(), 'zatca-csr-'));
    try {
      const keyPath = join(dir, 'key.pem');
      const configPath = join(dir, 'openssl.cnf');
      const csrPath = join(dir, 'csr.pem');

      writeFileSync(keyPath, privateKeyPem, { mode: 0o600 });
      writeFileSync(
        configPath,
        [
          '[req]',
          'distinguished_name = dn',
          'prompt = no',
          '',
          '[dn]',
          `CN = ${subject.commonName}`,
          `organizationIdentifier = ${subject.organizationIdentifier}`,
          `O = ${subject.organizationName}`,
          `OU = ${subject.organizationUnitName}`,
          `C = ${subject.countryCode}`,
          '',
        ].join('\n'),
        { mode: 0o600 },
      );

      execFileSync('openssl', ['req', '-new', '-key', keyPath, '-out', csrPath, '-config', configPath]);

      return readFileSync(csrPath, 'utf-8');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}
