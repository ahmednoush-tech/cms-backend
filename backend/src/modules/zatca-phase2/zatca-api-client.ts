import { Injectable, BadGatewayException } from '@nestjs/common';

export interface ZatcaComplianceCsidResponse {
  requestId: string;
  binarySecurityToken: string;
  secret: string;
}

export interface ZatcaClearanceResponse {
  clearanceStatus: string;
  clearedInvoice?: string;
  warnings?: string;
}

/**
 * UNVERIFIED AGAINST A LIVE ZATCA ENVIRONMENT — this whole file.
 * The endpoint paths and request/response field names below
 * reflect ZATCA's published Fatoora Integration Guide as best
 * recalled at implementation time. This sandbox has no network
 * access to actually call ZATCA's sandbox and confirm any of it.
 * Before real use: run each method once against ZATCA's own
 * sandbox with a real test CSID, and fix any field-name or
 * status-code mismatch this surfaces — treat that as an expected,
 * necessary step, not a sign something else is wrong.
 *
 * baseUrl should point at ZATCA's sandbox during onboarding/
 * testing and their production gateway only once a company has a
 * real production CSID — these are DIFFERENT hosts in ZATCA's own
 * infrastructure, so getting this config wrong sends real invoice
 * data to the wrong environment.
 */
@Injectable()
export class ZatcaApiClient {
  private baseUrl: string = process.env.ZATCA_API_BASE_URL ?? 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal';

  /**
   * Exchanges a CSR (plus a one-time OTP obtained by the person
   * doing the onboarding from ZATCA's Fatoora portal UI — this
   * cannot be automated, ZATCA requires a human to generate it) for
   * a Compliance CSID: a certificate and API secret used ONLY to
   * run ZATCA's compliance-check invoices, not for real clearance.
   */
  async requestComplianceCsid(csrPem: string, otp: string): Promise<ZatcaComplianceCsidResponse> {
    const csrBase64 = Buffer.from(csrPem, 'utf-8').toString('base64');
    const response = await fetch(`${this.baseUrl}/compliance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', OTP: otp },
      body: JSON.stringify({ csr: csrBase64 }),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.binarySecurityToken || !body?.secret) {
      throw new BadGatewayException(
        `ZATCA Compliance CSID request failed (HTTP ${response.status}): ${JSON.stringify(body)}. This may mean the request/response shape assumed here no longer matches ZATCA's current API — check their current Integration Guide.`,
      );
    }
    return { requestId: body.requestID ?? body.requestId, binarySecurityToken: body.binarySecurityToken, secret: body.secret };
  }

  /**
   * Exchanges an already-issued Compliance CSID (used as the
   * Basic-Auth credentials for this call) for a Production CSID —
   * the certificate actually used for real clearance/reporting.
   */
  async requestProductionCsid(complianceRequestId: string, complianceBinarySecurityToken: string, complianceSecret: string): Promise<ZatcaComplianceCsidResponse> {
    const auth = Buffer.from(`${complianceBinarySecurityToken}:${complianceSecret}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/production/csids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({ compliance_request_id: complianceRequestId }),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.binarySecurityToken || !body?.secret) {
      throw new BadGatewayException(
        `ZATCA Production CSID request failed (HTTP ${response.status}): ${JSON.stringify(body)}.`,
      );
    }
    return { requestId: body.requestID ?? body.requestId, binarySecurityToken: body.binarySecurityToken, secret: body.secret };
  }

  /** Standard/B2B invoices: MUST be cleared BEFORE the invoice is shared with the buyer — this call blocks issuance, it does not just log it afterward. */
  async clearInvoice(invoiceXmlBase64: string, invoiceHash: string, uuid: string, binarySecurityToken: string, secret: string): Promise<ZatcaClearanceResponse> {
    const auth = Buffer.from(`${binarySecurityToken}:${secret}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/invoices/clearance/single`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Basic ${auth}`,
        'Clearance-Status': '1',
      },
      body: JSON.stringify({ invoiceHash, uuid, invoice: invoiceXmlBase64 }),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new BadGatewayException(`ZATCA clearance request failed (HTTP ${response.status}): ${JSON.stringify(body)}.`);
    }
    return { clearanceStatus: body?.clearanceStatus ?? 'UNKNOWN', clearedInvoice: body?.clearedInvoice, warnings: body?.warnings ? JSON.stringify(body.warnings) : undefined };
  }

  /** Simplified/B2C invoices: reported AFTER issuance to the buyer (within 24 hours), not blocking — the invoice is already valid to the buyer regardless of this call's outcome. */
  async reportInvoice(invoiceXmlBase64: string, invoiceHash: string, uuid: string, binarySecurityToken: string, secret: string): Promise<ZatcaClearanceResponse> {
    const auth = Buffer.from(`${binarySecurityToken}:${secret}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/invoices/reporting/single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({ invoiceHash, uuid, invoice: invoiceXmlBase64 }),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new BadGatewayException(`ZATCA reporting request failed (HTTP ${response.status}): ${JSON.stringify(body)}.`);
    }
    return { clearanceStatus: body?.reportingStatus ?? 'UNKNOWN', warnings: body?.warnings ? JSON.stringify(body.warnings) : undefined };
  }
}
