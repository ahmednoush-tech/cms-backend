import { Test } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import { ZatcaInvoiceSubmissionService } from './zatca-invoice-submission.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ZatcaCertificateService } from './zatca-certificate.service';
import { ZatcaCryptoService } from './zatca-crypto.service';
import { ZatcaUblInvoiceBuilder } from './zatca-ubl-invoice-builder';
import { ZatcaApiClient } from './zatca-api-client';

describe('ZatcaInvoiceSubmissionService', () => {
  let service: ZatcaInvoiceSubmissionService;
  let prisma: any;
  let certificateService: any;
  let cryptoService: any;
  let ublBuilder: any;
  let apiClient: any;

  const completeSettings = {
    sellerName: 'Acme Co',
    vatRegistrationNumber: '300000000000003',
    sellerStreetName: 'King Fahd Rd',
    sellerBuildingNumber: '1234',
    sellerDistrict: 'Al Olaya',
    sellerCity: 'Riyadh',
    sellerPostalCode: '12211',
    lastZatcaIcv: 5,
  };

  const validInvoice = {
    id: 'inv-1',
    invoiceNumber: 'INV-2026-0001',
    issuedAt: new Date('2026-06-15T14:30:00Z'),
    currencyCode: 'SAR',
    customer: { companyName: 'Buyer LLC', vatRegistrationNumber: '300000000000099' },
    items: [{ description: 'Widget', quantity: '5.00', unitPrice: '100.00', discount: '0', tax: '75.00', total: '575.00' }],
    subtotal: '500.00',
    tax: '75.00',
    total: '575.00',
  };

  const validCredentials = { certificateId: 'cert-1', privateKeyPem: 'PRIVATE_KEY', binarySecurityToken: 'TOKEN', apiSecret: 'secret' };

  beforeEach(async () => {
    prisma = {
      financeSettings: { findUnique: jest.fn(), update: jest.fn() },
      zatcaSubmission: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    certificateService = { getActiveProductionCredentials: jest.fn() };
    cryptoService = {
      hashXml: jest.fn().mockReturnValue('HASH_BASE64'),
      signXml: jest.fn().mockReturnValue(Buffer.alloc(64, 1)),
    };
    ublBuilder = { build: jest.fn().mockReturnValue('<Invoice>...</Invoice>') };
    apiClient = { clearInvoice: jest.fn(), reportInvoice: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ZatcaInvoiceSubmissionService,
        { provide: PrismaService, useValue: prisma },
        { provide: ZatcaCertificateService, useValue: certificateService },
        { provide: ZatcaCryptoService, useValue: cryptoService },
        { provide: ZatcaUblInvoiceBuilder, useValue: ublBuilder },
        { provide: ZatcaApiClient, useValue: apiClient },
      ],
    }).compile();

    service = moduleRef.get(ZatcaInvoiceSubmissionService);
  });

  it('returns null (no-op) when the company has no active production certificate — not onboarded to Phase 2', async () => {
    certificateService.getActiveProductionCredentials.mockRejectedValue(new Error('not found'));

    const result = await service.submitInvoice('company-1', validInvoice);

    expect(result).toBeNull();
    expect(ublBuilder.build).not.toHaveBeenCalled();
  });

  it('rejects when Finance Settings is missing required seller address fields', async () => {
    certificateService.getActiveProductionCredentials.mockResolvedValue(validCredentials);
    prisma.financeSettings.findUnique.mockResolvedValue({ sellerName: 'Acme Co', vatRegistrationNumber: '300000000000003' });

    await expect(service.submitInvoice('company-1', validInvoice)).rejects.toThrow(UnprocessableEntityException);
  });

  it('classifies an invoice as "standard" (clearance) when the customer has a VAT number, "simplified" (reporting) otherwise', async () => {
    certificateService.getActiveProductionCredentials.mockResolvedValue(validCredentials);
    prisma.financeSettings.findUnique.mockResolvedValue(completeSettings);
    prisma.zatcaSubmission.findFirst.mockResolvedValue(null);
    prisma.financeSettings.update.mockResolvedValue({ ...completeSettings, lastZatcaIcv: 6 });
    prisma.zatcaSubmission.create.mockResolvedValue({ id: 'sub-1' });
    apiClient.clearInvoice.mockResolvedValue({ clearanceStatus: 'CLEARED' });

    await service.submitInvoice('company-1', validInvoice);

    expect(apiClient.clearInvoice).toHaveBeenCalled();
    expect(apiClient.reportInvoice).not.toHaveBeenCalled();

    jest.clearAllMocks();
    certificateService.getActiveProductionCredentials.mockResolvedValue(validCredentials);
    prisma.financeSettings.findUnique.mockResolvedValue(completeSettings);
    prisma.zatcaSubmission.findFirst.mockResolvedValue(null);
    prisma.financeSettings.update.mockResolvedValue({ ...completeSettings, lastZatcaIcv: 6 });
    prisma.zatcaSubmission.create.mockResolvedValue({ id: 'sub-2' });
    apiClient.reportInvoice.mockResolvedValue({ clearanceStatus: 'REPORTED' });

    await service.submitInvoice('company-1', { ...validInvoice, customer: { companyName: 'Walk-in' } });

    expect(apiClient.reportInvoice).toHaveBeenCalled();
    expect(apiClient.clearInvoice).not.toHaveBeenCalled();
  });

  it('uses "0" as the previous invoice hash when this is the very first submission for the company', async () => {
    certificateService.getActiveProductionCredentials.mockResolvedValue(validCredentials);
    prisma.financeSettings.findUnique.mockResolvedValue(completeSettings);
    prisma.zatcaSubmission.findFirst.mockResolvedValue(null);
    prisma.financeSettings.update.mockResolvedValue({ ...completeSettings, lastZatcaIcv: 6 });
    prisma.zatcaSubmission.create.mockResolvedValue({ id: 'sub-1' });
    apiClient.clearInvoice.mockResolvedValue({ clearanceStatus: 'CLEARED' });

    await service.submitInvoice('company-1', validInvoice);

    const buildArgs = ublBuilder.build.mock.calls[0][0];
    expect(buildArgs.previousInvoiceHash).toBe('0');
  });

  it("chains to the LAST successful submission's hash when one exists", async () => {
    certificateService.getActiveProductionCredentials.mockResolvedValue(validCredentials);
    prisma.financeSettings.findUnique.mockResolvedValue(completeSettings);
    prisma.zatcaSubmission.findFirst.mockResolvedValue({ invoiceHash: 'PREVIOUS_HASH_B64' });
    prisma.financeSettings.update.mockResolvedValue({ ...completeSettings, lastZatcaIcv: 6 });
    prisma.zatcaSubmission.create.mockResolvedValue({ id: 'sub-1' });
    apiClient.clearInvoice.mockResolvedValue({ clearanceStatus: 'CLEARED' });

    await service.submitInvoice('company-1', validInvoice);

    const buildArgs = ublBuilder.build.mock.calls[0][0];
    expect(buildArgs.previousInvoiceHash).toBe('PREVIOUS_HASH_B64');
  });

  it('atomically increments the ICV counter rather than deriving it by counting rows', async () => {
    certificateService.getActiveProductionCredentials.mockResolvedValue(validCredentials);
    prisma.financeSettings.findUnique.mockResolvedValue(completeSettings);
    prisma.zatcaSubmission.findFirst.mockResolvedValue(null);
    prisma.financeSettings.update.mockResolvedValue({ ...completeSettings, lastZatcaIcv: 6 });
    prisma.zatcaSubmission.create.mockResolvedValue({ id: 'sub-1' });
    apiClient.clearInvoice.mockResolvedValue({ clearanceStatus: 'CLEARED' });

    await service.submitInvoice('company-1', validInvoice);

    const updateCall = prisma.financeSettings.update.mock.calls[0][0];
    expect(updateCall.data.lastZatcaIcv).toEqual({ increment: 1 });
  });

  it('does NOT throw when the ZATCA API call fails — records the submission as failed instead, so an issued invoice is never rolled back for a ZATCA-side failure', async () => {
    certificateService.getActiveProductionCredentials.mockResolvedValue(validCredentials);
    prisma.financeSettings.findUnique.mockResolvedValue(completeSettings);
    prisma.zatcaSubmission.findFirst.mockResolvedValue(null);
    prisma.financeSettings.update.mockResolvedValue({ ...completeSettings, lastZatcaIcv: 6 });
    prisma.zatcaSubmission.create.mockResolvedValue({ id: 'sub-1' });
    apiClient.clearInvoice.mockRejectedValue(new Error('ZATCA is down'));

    const result = await service.submitInvoice('company-1', validInvoice);

    expect(result?.status).toBe('failed');
    const updateCall = prisma.zatcaSubmission.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('failed');
  });

  it('signs the CANONICAL XML produced by the UBL builder, not some other value', async () => {
    certificateService.getActiveProductionCredentials.mockResolvedValue(validCredentials);
    prisma.financeSettings.findUnique.mockResolvedValue(completeSettings);
    prisma.zatcaSubmission.findFirst.mockResolvedValue(null);
    prisma.financeSettings.update.mockResolvedValue({ ...completeSettings, lastZatcaIcv: 6 });
    prisma.zatcaSubmission.create.mockResolvedValue({ id: 'sub-1' });
    apiClient.clearInvoice.mockResolvedValue({ clearanceStatus: 'CLEARED' });

    await service.submitInvoice('company-1', validInvoice);

    expect(cryptoService.signXml).toHaveBeenCalledWith('<Invoice>...</Invoice>', 'PRIVATE_KEY');
    expect(cryptoService.hashXml).toHaveBeenCalledWith('<Invoice>...</Invoice>');
  });
});
