import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ZatcaCertificateService } from './zatca-certificate.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ZatcaCryptoService } from './zatca-crypto.service';
import { ZatcaApiClient } from './zatca-api-client';

jest.mock('../../common/utils/credentials-encryption.util', () => ({
  encryptCredential: jest.fn((plaintext: string) => `ENCRYPTED(${plaintext})`),
  decryptCredential: jest.fn((stored: string) => stored.replace('ENCRYPTED(', '').replace(')', '')),
}));

describe('ZatcaCertificateService', () => {
  let service: ZatcaCertificateService;
  let prisma: any;
  let cryptoService: any;
  let apiClient: any;

  beforeEach(async () => {
    prisma = {
      financeSettings: { findUnique: jest.fn() },
      zatcaCertificate: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    };
    cryptoService = {
      generateKeyPair: jest.fn().mockReturnValue({ privateKeyPem: 'PRIVATE_KEY_PEM', publicKeyPem: 'PUBLIC_KEY_PEM' }),
      generateCsr: jest.fn().mockReturnValue('CSR_PEM'),
    };
    apiClient = { requestComplianceCsid: jest.fn(), requestProductionCsid: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ZatcaCertificateService,
        { provide: PrismaService, useValue: prisma },
        { provide: ZatcaCryptoService, useValue: cryptoService },
        { provide: ZatcaApiClient, useValue: apiClient },
      ],
    }).compile();

    service = moduleRef.get(ZatcaCertificateService);
  });

  describe('list', () => {
    it('never returns the private key or API secret — only whether a certificate is set', async () => {
      prisma.zatcaCertificate.findMany.mockResolvedValue([
        { id: 'c1', csidType: 'production', status: 'active', certificatePem: 'CERT', privateKeyEncrypted: 'ENCRYPTED(secret-key)', apiSecretEncrypted: 'ENCRYPTED(secret-api)', issuedAt: null, expiresAt: null, createdAt: new Date() },
      ]);

      const result = await service.list('company-1');

      expect(JSON.stringify(result)).not.toContain('secret-key');
      expect(JSON.stringify(result)).not.toContain('secret-api');
      expect((result[0] as any).hasCertificate).toBe(true);
    });
  });

  describe('generateCsr', () => {
    it('rejects when Finance Settings has no seller name / VAT number configured yet', async () => {
      prisma.financeSettings.findUnique.mockResolvedValue({ sellerName: null, vatRegistrationNumber: null });

      await expect(service.generateCsr('company-1', { csidType: 'compliance', organizationUnitName: 'Riyadh' })).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(cryptoService.generateCsr).not.toHaveBeenCalled();
    });

    it('encrypts the private key before storing it — the plaintext never reaches the database call', async () => {
      prisma.financeSettings.findUnique.mockResolvedValue({ sellerName: 'Acme Co', vatRegistrationNumber: '300000000000003' });
      prisma.zatcaCertificate.create.mockResolvedValue({ id: 'cert-1' });

      await service.generateCsr('company-1', { csidType: 'compliance', organizationUnitName: 'Riyadh Branch' });

      const call = prisma.zatcaCertificate.create.mock.calls[0][0];
      expect(call.data.privateKeyEncrypted).toBe('ENCRYPTED(PRIVATE_KEY_PEM)');
      expect(call.data.status).toBe('pending_csr');
    });

    it('passes the VAT number as organizationIdentifier to the CSR generator, not some other field', async () => {
      prisma.financeSettings.findUnique.mockResolvedValue({ sellerName: 'Acme Co', vatRegistrationNumber: '300000000000003' });
      prisma.zatcaCertificate.create.mockResolvedValue({ id: 'cert-1' });

      await service.generateCsr('company-1', { csidType: 'production', organizationUnitName: 'Jeddah Branch' });

      const csrArgs = cryptoService.generateCsr.mock.calls[0][1];
      expect(csrArgs.organizationIdentifier).toBe('300000000000003');
      expect(csrArgs.organizationUnitName).toBe('Jeddah Branch');
    });
  });

  describe('requestComplianceCsid', () => {
    it('404s when the certificate record does not belong to this company', async () => {
      prisma.zatcaCertificate.findFirst.mockResolvedValue(null);

      await expect(service.requestComplianceCsid('company-1', 'cert-1', '123456')).rejects.toThrow(NotFoundException);
    });

    it('rejects a record that was created for production, not compliance', async () => {
      prisma.zatcaCertificate.findFirst.mockResolvedValue({ id: 'cert-1', csidType: 'production', csrPem: 'CSR' });

      await expect(service.requestComplianceCsid('company-1', 'cert-1', '123456')).rejects.toThrow(UnprocessableEntityException);
    });

    it('encrypts the returned API secret before storing it', async () => {
      prisma.zatcaCertificate.findFirst.mockResolvedValue({ id: 'cert-1', csidType: 'compliance', csrPem: 'CSR_PEM' });
      apiClient.requestComplianceCsid.mockResolvedValue({ requestId: 'req-1', binarySecurityToken: 'TOKEN', secret: 'plain-secret' });
      prisma.zatcaCertificate.update.mockResolvedValue({ id: 'cert-1' });

      await service.requestComplianceCsid('company-1', 'cert-1', '123456');

      const call = prisma.zatcaCertificate.update.mock.calls[0][0];
      expect(call.data.apiSecretEncrypted).toBe('ENCRYPTED(plain-secret)');
      expect(call.data.status).toBe('active');
    });
  });

  describe('requestProductionCsid', () => {
    it('rejects when the compliance certificate is not yet active', async () => {
      prisma.zatcaCertificate.findFirst.mockResolvedValue({ id: 'c1', csidType: 'compliance', status: 'pending_csr' });

      await expect(service.requestProductionCsid('company-1', 'c1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('generates a FRESH key pair for the production certificate, not reusing the compliance one', async () => {
      prisma.zatcaCertificate.findFirst.mockResolvedValue({
        id: 'c1', csidType: 'compliance', status: 'active', zatcaRequestId: 'req-1', binarySecurityToken: 'TOKEN', apiSecretEncrypted: 'ENCRYPTED(compliance-secret)',
      });
      apiClient.requestProductionCsid.mockResolvedValue({ requestId: 'req-2', binarySecurityToken: 'PROD_TOKEN', secret: 'prod-secret' });
      prisma.zatcaCertificate.create.mockResolvedValue({ id: 'c2' });

      await service.requestProductionCsid('company-1', 'c1');

      expect(cryptoService.generateKeyPair).toHaveBeenCalledTimes(1);
      const call = prisma.zatcaCertificate.create.mock.calls[0][0];
      expect(call.data.csidType).toBe('production');
      expect(call.data.privateKeyEncrypted).toBe('ENCRYPTED(PRIVATE_KEY_PEM)');
    });
  });

  describe('getActiveProductionCredentials', () => {
    it('404s when no active production certificate exists', async () => {
      prisma.zatcaCertificate.findFirst.mockResolvedValue(null);

      await expect(service.getActiveProductionCredentials('company-1')).rejects.toThrow(NotFoundException);
    });

    it('decrypts and returns the private key and secret for internal use', async () => {
      prisma.zatcaCertificate.findFirst.mockResolvedValue({
        id: 'c1', privateKeyEncrypted: 'ENCRYPTED(real-private-key)', binarySecurityToken: 'TOKEN', apiSecretEncrypted: 'ENCRYPTED(real-secret)',
      });

      const result = await service.getActiveProductionCredentials('company-1');

      expect(result.privateKeyPem).toBe('real-private-key');
      expect(result.apiSecret).toBe('real-secret');
    });
  });
});
