import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ZatcaCryptoService } from './zatca-crypto.service';
import { ZatcaApiClient } from './zatca-api-client';
import { encryptCredential, decryptCredential } from '../../common/utils/credentials-encryption.util';
import { GenerateZatcaCsrDto } from './dto/generate-zatca-csr.dto';

@Injectable()
export class ZatcaCertificateService {
  constructor(
    private prisma: PrismaService,
    private cryptoService: ZatcaCryptoService,
    private apiClient: ZatcaApiClient,
  ) {}

  /** Never returns the private key or API secret — only whether they're set, matching the pattern already established for S3 credentials (PlatformStorageSettingsService.get()). */
  async list(companyId: string) {
    const rows = await this.prisma.zatcaCertificate.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => ({
      id: r.id,
      csidType: r.csidType,
      status: r.status,
      hasCertificate: !!r.certificatePem,
      issuedAt: r.issuedAt,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Step 1 of onboarding: generate a fresh key pair and CSR for
   * this company, store the private key ENCRYPTED immediately, and
   * leave status as 'pending_csr' until a human takes the CSR to
   * ZATCA's Fatoora portal, gets an OTP, and this service's
   * requestComplianceCsid() (below) is called with it.
   */
  async generateCsr(companyId: string, dto: GenerateZatcaCsrDto) {
    const { privateKeyPem } = this.cryptoService.generateKeyPair();

    const settings = await this.prisma.financeSettings.findUnique({ where: { companyId } });
    if (!settings?.sellerName || !settings?.vatRegistrationNumber) {
      throw new UnprocessableEntityException('Configure the seller name and VAT registration number in Finance Settings before generating a ZATCA CSR.');
    }

    const csrPem = this.cryptoService.generateCsr(privateKeyPem, {
      commonName: dto.commonName ?? `1-${settings.sellerName}|2-1.0|3-${randomUUID()}`,
      organizationIdentifier: settings.vatRegistrationNumber,
      organizationUnitName: dto.organizationUnitName,
      organizationName: settings.sellerName,
      countryCode: 'SA',
    });

    return this.prisma.zatcaCertificate.create({
      data: {
        companyId,
        csidType: dto.csidType,
        privateKeyEncrypted: encryptCredential(privateKeyPem),
        csrPem,
        status: 'pending_csr',
      },
      select: { id: true, csidType: true, status: true, csrPem: true, createdAt: true },
    });
  }

  /**
   * Step 2: a human has taken the CSR from generateCsr() above to
   * ZATCA's Fatoora portal, received a one-time OTP, and now this
   * exchanges the CSR for a real Compliance CSID via ZatcaApiClient
   * — see that file's disclosure that this exchange has not been
   * verified against a live ZATCA environment.
   */
  async requestComplianceCsid(companyId: string, certificateId: string, otp: string) {
    const record = await this.getOwnedRecord(companyId, certificateId);
    if (record.csidType !== 'compliance') {
      throw new UnprocessableEntityException('This certificate record was not created for a compliance CSID request.');
    }
    if (!record.csrPem) {
      throw new UnprocessableEntityException('No CSR stored on this record — call generateCsr() first.');
    }

    const result = await this.apiClient.requestComplianceCsid(record.csrPem, otp);

    return this.prisma.zatcaCertificate.update({
      where: { id: certificateId },
      data: {
        binarySecurityToken: result.binarySecurityToken,
        apiSecretEncrypted: encryptCredential(result.secret),
        zatcaRequestId: result.requestId,
        status: 'active',
        issuedAt: new Date(),
      },
      select: { id: true, csidType: true, status: true, issuedAt: true },
    });
  }

  /** Step 3: exchange an ACTIVE compliance CSID for a production one — the certificate actually used for real clearance/reporting going forward. */
  async requestProductionCsid(companyId: string, complianceCertificateId: string) {
    const compliance = await this.getOwnedRecord(companyId, complianceCertificateId);
    if (compliance.csidType !== 'compliance' || compliance.status !== 'active') {
      throw new UnprocessableEntityException('An active compliance CSID is required before requesting a production CSID.');
    }
    if (!compliance.zatcaRequestId || !compliance.apiSecretEncrypted) {
      throw new UnprocessableEntityException('This compliance certificate is missing its ZATCA request ID or secret.');
    }

    const secret = decryptCredential(compliance.apiSecretEncrypted);
    const result = await this.apiClient.requestProductionCsid(compliance.zatcaRequestId, compliance.binarySecurityToken!, secret);

    // A fresh key pair for production, per ZATCA's own guidance that compliance and production CSIDs should not share a private key.
    const { privateKeyPem } = this.cryptoService.generateKeyPair();

    return this.prisma.zatcaCertificate.create({
      data: {
        companyId,
        csidType: 'production',
        privateKeyEncrypted: encryptCredential(privateKeyPem),
        binarySecurityToken: result.binarySecurityToken,
        apiSecretEncrypted: encryptCredential(result.secret),
        zatcaRequestId: result.requestId,
        status: 'active',
        issuedAt: new Date(),
      },
      select: { id: true, csidType: true, status: true, issuedAt: true },
    });
  }

  /** INTERNAL ONLY — the sole path that decrypts the private key/secret, for the invoice-signing/clearance flow to actually use. Never exposed via a controller. */
  async getActiveProductionCredentials(companyId: string) {
    const record = await this.prisma.zatcaCertificate.findFirst({
      where: { companyId, csidType: 'production', status: 'active' },
      orderBy: { issuedAt: 'desc' },
    });
    if (!record || !record.apiSecretEncrypted) {
      throw new NotFoundException('No active ZATCA production certificate found for this company — complete onboarding first.');
    }
    return {
      certificateId: record.id,
      privateKeyPem: decryptCredential(record.privateKeyEncrypted),
      binarySecurityToken: record.binarySecurityToken!,
      apiSecret: decryptCredential(record.apiSecretEncrypted),
    };
  }

  private async getOwnedRecord(companyId: string, id: string) {
    const record = await this.prisma.zatcaCertificate.findFirst({ where: { id, companyId } });
    if (!record) throw new NotFoundException('ZATCA certificate record not found.');
    return record;
  }
}
