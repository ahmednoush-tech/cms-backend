export type ZatcaCsidType = 'compliance' | 'production';
export type ZatcaCertificateStatus = 'pending_csr' | 'pending_zatca_issuance' | 'active' | 'expired' | 'revoked';

export interface ZatcaCertificateSummary {
  id: string;
  csidType: ZatcaCsidType;
  status: ZatcaCertificateStatus;
  hasCertificate: boolean;
  issuedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface GenerateZatcaCsrInput {
  csidType: ZatcaCsidType;
  organizationUnitName: string;
  commonName?: string;
}

/** Only returned once, immediately after generateCsr() — never again afterward (the CSR isn't re-exposed by the list endpoint). */
export interface ZatcaCsrResult {
  id: string;
  csidType: ZatcaCsidType;
  status: ZatcaCertificateStatus;
  csrPem: string;
  createdAt: string;
}
