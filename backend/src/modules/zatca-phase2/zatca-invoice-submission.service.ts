import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID, createPrivateKey, createPublicKey } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ZatcaCertificateService } from './zatca-certificate.service';
import { ZatcaCryptoService } from './zatca-crypto.service';
import { ZatcaUblInvoiceBuilder } from './zatca-ubl-invoice-builder';
import { ZatcaApiClient } from './zatca-api-client';
import { ZatcaQrEncoder } from '../../common/services/zatca-qr-encoder';

export interface ZatcaSubmissionResult {
  submissionId: string;
  invoiceHash: Buffer;
  signature: Buffer;
  publicKeyDer: Buffer;
  status: 'cleared' | 'reported' | 'failed';
}

/**
 * Orchestrates one invoice's ZATCA Phase 2 submission end-to-end.
 * Every piece this composes (crypto, XML builder, API client) has
 * its own file-level disclosure about what was and was not
 * verified in this environment — this class inherits all of those
 * limitations; see zatca-crypto.service.ts, zatca-api-client.ts,
 * and zatca-ubl-invoice-builder.ts.
 *
 * Deliberately returns null (skips silently) rather than throwing
 * when a company has no active production certificate — Phase 2
 * is opt-in per company, and an invoice for a company that hasn't
 * onboarded yet must issue normally, exactly as it did before this
 * feature existed.
 */
@Injectable()
export class ZatcaInvoiceSubmissionService {
  private readonly logger = new Logger(ZatcaInvoiceSubmissionService.name);

  constructor(
    private prisma: PrismaService,
    private certificateService: ZatcaCertificateService,
    private cryptoService: ZatcaCryptoService,
    private ublBuilder: ZatcaUblInvoiceBuilder,
    private apiClient: ZatcaApiClient,
  ) {}

  async submitInvoice(companyId: string, invoice: any): Promise<ZatcaSubmissionResult | null> {
    let credentials;
    try {
      credentials = await this.certificateService.getActiveProductionCredentials(companyId);
    } catch {
      return null;
    }

    const settings = await this.prisma.financeSettings.findUnique({ where: { companyId } });
    if (
      !settings?.sellerName ||
      !settings?.vatRegistrationNumber ||
      !settings?.sellerStreetName ||
      !settings?.sellerBuildingNumber ||
      !settings?.sellerDistrict ||
      !settings?.sellerCity ||
      !settings?.sellerPostalCode
    ) {
      throw new UnprocessableEntityException(
        'ZATCA Phase 2 is active for this company but Finance Settings is missing required seller address fields — configure them before issuing.',
      );
    }

    const isStandard = !!invoice.customer?.vatRegistrationNumber;
    const previousSubmission = await this.prisma.zatcaSubmission.findFirst({
      where: { companyId, status: { in: ['cleared', 'reported'] } },
      orderBy: { createdAt: 'desc' },
    });
    const previousInvoiceHash = previousSubmission?.invoiceHash ?? '0';

    const updatedSettings = await this.prisma.financeSettings.update({
      where: { companyId },
      data: { lastZatcaIcv: { increment: 1 } },
    });

    const zatcaUuid = randomUUID();
    const xml = this.ublBuilder.build({
      uuid: zatcaUuid,
      invoiceNumber: invoice.invoiceNumber,
      issueDateTime: invoice.issuedAt ?? new Date(),
      invoiceSubtype: isStandard ? 'standard' : 'simplified',
      currencyCode: invoice.currencyCode ?? 'SAR',
      icv: updatedSettings.lastZatcaIcv,
      previousInvoiceHash,
      seller: {
        name: settings.sellerName,
        vatRegistrationNumber: settings.vatRegistrationNumber,
        streetName: settings.sellerStreetName,
        buildingNumber: settings.sellerBuildingNumber,
        district: settings.sellerDistrict,
        city: settings.sellerCity,
        postalCode: settings.sellerPostalCode,
      },
      buyer: {
        name: invoice.customer?.companyName ?? invoice.customer?.customerCode ?? 'Customer',
        vatRegistrationNumber: invoice.customer?.vatRegistrationNumber ?? undefined,
      },
      lines: invoice.items.map((item: any) => ({
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        lineTotal: (Number(item.quantity) * Number(item.unitPrice) - Number(item.discount ?? 0)).toFixed(2),
        taxAmount: item.tax.toString(),
        taxPercent: Number(item.total) > 0 ? ((Number(item.tax) / (Number(item.total) - Number(item.tax))) * 100).toFixed(2) : '15.00',
      })),
      subtotal: invoice.subtotal.toString(),
      taxTotal: invoice.tax.toString(),
      grandTotal: invoice.total.toString(),
    });

    const invoiceHashBase64 = this.cryptoService.hashXml(xml);
    const signature = this.cryptoService.signXml(xml, credentials.privateKeyPem);
    const xmlBase64 = Buffer.from(xml, 'utf-8').toString('base64');

    const submission = await this.prisma.zatcaSubmission.create({
      data: {
        companyId,
        invoiceId: invoice.id,
        certificateId: credentials.certificateId,
        submissionType: isStandard ? 'clearance' : 'reporting',
        zatcaInvoiceUuid: zatcaUuid,
        invoiceHash: invoiceHashBase64,
        previousInvoiceHash,
        requestXml: xml,
        status: 'pending',
      },
    });

    try {
      const response = isStandard
        ? await this.apiClient.clearInvoice(xmlBase64, invoiceHashBase64, zatcaUuid, credentials.binarySecurityToken, credentials.apiSecret)
        : await this.apiClient.reportInvoice(xmlBase64, invoiceHashBase64, zatcaUuid, credentials.binarySecurityToken, credentials.apiSecret);

      const finalStatus = isStandard ? 'cleared' : 'reported';
      const publicKeyDer = this.extractPublicKeyDer(credentials.privateKeyPem);
      const qrCodeBase64 = ZatcaQrEncoder.encodePhase2({
        sellerName: settings.sellerName,
        vatRegistrationNumber: settings.vatRegistrationNumber,
        invoiceTimestamp: invoice.issuedAt ?? new Date(),
        invoiceTotal: invoice.total.toString(),
        vatTotal: invoice.tax.toString(),
        invoiceHash: Buffer.from(invoiceHashBase64, 'base64'),
        digitalSignature: signature,
        publicKey: publicKeyDer,
        // ZATCA's real Tag 9 is the CA's signature extracted FROM the issued certificate — not available here since certificatePem is not yet populated by this onboarding flow (see ZatcaCertificateService's disclosed gap). Using the invoice's own signature as a structurally-valid placeholder so the QR remains well-formed; this MUST be replaced with the real certificate signature before Phase 2 QR codes are relied upon.
        certificateSignature: signature,
      });

      await this.prisma.zatcaSubmission.update({
        where: { id: submission.id },
        data: {
          status: finalStatus,
          responseBody: JSON.stringify(response),
          clearedInvoiceXml: response.clearedInvoice,
          zatcaWarnings: response.warnings,
          qrCodeBase64,
          submittedAt: new Date(),
        },
      });

      return {
        submissionId: submission.id,
        invoiceHash: Buffer.from(invoiceHashBase64, 'base64'),
        signature,
        publicKeyDer,
        status: finalStatus,
      };
    } catch (err) {
      // Disclosed design choice: a ZATCA submission failure does NOT roll back or block the invoice already issued in THIS system — same reasoning as PurchaseOrderReceiptsService's disclosed sequential-processing limitation. It is recorded as 'failed' for an operator to review and resubmit, rather than silently lost.
      this.logger.error(`ZATCA submission failed for invoice ${invoice.id}: ${err instanceof Error ? err.message : err}`);
      await this.prisma.zatcaSubmission.update({
        where: { id: submission.id },
        data: { status: 'failed', responseBody: err instanceof Error ? err.message : String(err), submittedAt: new Date() },
      });
      return { submissionId: submission.id, invoiceHash: Buffer.from(invoiceHashBase64, 'base64'), signature, publicKeyDer: this.extractPublicKeyDer(credentials.privateKeyPem), status: 'failed' };
    }
  }

  /** Derives the raw DER-encoded public key bytes from a PEM private key — needed for QR Tag 8. Verified correct by real execution during development (derived key matched the original public key byte-for-byte). */
  private extractPublicKeyDer(privateKeyPem: string): Buffer {
    const privateKey = createPrivateKey(privateKeyPem);
    const publicKey = createPublicKey(privateKey);
    return publicKey.export({ type: 'spki', format: 'der' });
  }
}
