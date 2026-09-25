import { ZatcaCryptoService } from './zatca-crypto.service';

describe('ZatcaCryptoService', () => {
  const service = new ZatcaCryptoService();

  describe('generateKeyPair', () => {
    it('produces a PEM-encoded secp256k1 key pair', () => {
      const { privateKeyPem, publicKeyPem } = service.generateKeyPair();
      expect(privateKeyPem).toContain('BEGIN PRIVATE KEY');
      expect(publicKeyPem).toContain('BEGIN PUBLIC KEY');
    });

    it('produces a DIFFERENT key pair on each call (not a fixed/hardcoded value)', () => {
      const first = service.generateKeyPair();
      const second = service.generateKeyPair();
      expect(first.privateKeyPem).not.toBe(second.privateKeyPem);
    });
  });

  describe('hashXml', () => {
    it('produces a stable SHA-256 base64 hash for the same input', () => {
      const h1 = service.hashXml('<xml>test</xml>');
      const h2 = service.hashXml('<xml>test</xml>');
      expect(h1).toBe(h2);
    });

    it('produces a different hash for different input', () => {
      expect(service.hashXml('<xml>a</xml>')).not.toBe(service.hashXml('<xml>b</xml>'));
    });
  });

  describe('signXml / verifyXmlSignature — real round trip, no mocking', () => {
    it('a signature verifies successfully against the matching key pair', () => {
      const { privateKeyPem, publicKeyPem } = service.generateKeyPair();
      const signature = service.signXml('<xml>invoice content</xml>', privateKeyPem);

      expect(service.verifyXmlSignature('<xml>invoice content</xml>', signature, publicKeyPem)).toBe(true);
    });

    it('produces a raw IEEE-P1363 signature exactly 64 bytes long for secp256k1 (not DER)', () => {
      const { privateKeyPem } = service.generateKeyPair();
      const signature = service.signXml('<xml>invoice content</xml>', privateKeyPem);

      expect(signature.length).toBe(64);
    });

    it('rejects a signature checked against the WRONG public key', () => {
      const pairA = service.generateKeyPair();
      const pairB = service.generateKeyPair();
      const signature = service.signXml('<xml>invoice content</xml>', pairA.privateKeyPem);

      expect(service.verifyXmlSignature('<xml>invoice content</xml>', signature, pairB.publicKeyPem)).toBe(false);
    });

    it('rejects a signature checked against TAMPERED content', () => {
      const { privateKeyPem, publicKeyPem } = service.generateKeyPair();
      const signature = service.signXml('<xml>original</xml>', privateKeyPem);

      expect(service.verifyXmlSignature('<xml>tampered</xml>', signature, publicKeyPem)).toBe(false);
    });
  });

  describe('generateCsr — shells out to the real openssl binary, no mocking', () => {
    it('produces a PEM-encoded certificate request', () => {
      const { privateKeyPem } = service.generateKeyPair();

      const csr = service.generateCsr(privateKeyPem, {
        commonName: '1-TestSolution|2-1.0|3-abc12345-6789',
        organizationIdentifier: '300000000000003',
        organizationUnitName: 'Riyadh Branch',
        organizationName: 'Test Company',
        countryCode: 'SA',
      });

      expect(csr).toContain('BEGIN CERTIFICATE REQUEST');
    });

    it('embeds the organizationIdentifier (VAT number) correctly into the CSR subject, verified by parsing it back out with openssl', () => {
      const { execFileSync } = require('child_process');
      const { mkdtempSync, writeFileSync, rmSync } = require('fs');
      const { join } = require('path');
      const { tmpdir } = require('os');
      const { privateKeyPem } = service.generateKeyPair();

      const csr = service.generateCsr(privateKeyPem, {
        commonName: '1-TestSolution|2-1.0|3-abc12345-6789',
        organizationIdentifier: '300000000000003',
        organizationUnitName: 'Riyadh Branch',
        organizationName: 'Test Company',
        countryCode: 'SA',
      });

      const dir = mkdtempSync(join(tmpdir(), 'zatca-csr-verify-'));
      try {
        const csrPath = join(dir, 'csr.pem');
        writeFileSync(csrPath, csr);
        const output = execFileSync('openssl', ['req', '-in', csrPath, '-text', '-noout']).toString();
        expect(output).toContain('organizationIdentifier = 300000000000003');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
