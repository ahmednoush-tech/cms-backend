/** Escapes the 5 XML predefined entities — every piece of user-controlled text (names, addresses, descriptions) MUST pass through this before being placed into the XML string, or a name containing '&' or '<' would produce malformed/injected XML. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface ZatcaInvoiceLineInput {
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  taxAmount: string;
  taxPercent: string;
}

export interface ZatcaSellerInput {
  name: string;
  vatRegistrationNumber: string;
  streetName: string;
  buildingNumber: string;
  district: string;
  city: string;
  postalCode: string;
}

export interface ZatcaBuyerInput {
  name: string;
  vatRegistrationNumber?: string;
}

export interface ZatcaInvoiceInput {
  /** ZATCA's own invoice UUID — NOT the same as this system's own invoice id; generate a fresh UUID per submission. */
  uuid: string;
  invoiceNumber: string;
  issueDateTime: Date;
  /** 'standard' (B2B, requires clearance) or 'simplified' (B2C, reporting only) — determines InvoiceTypeCode's subtype digits. */
  invoiceSubtype: 'standard' | 'simplified';
  currencyCode: string;
  /** Invoice Counter Value — a strictly sequential integer per company, never reused, never skipped. Callers must supply this from their own persisted counter, not compute it here. */
  icv: number;
  /** Base64 hash of the PREVIOUS invoice in this company's sequence — '0' (per ZATCA's convention) only for the very first invoice ever issued under a given CSID. */
  previousInvoiceHash: string;
  seller: ZatcaSellerInput;
  buyer: ZatcaBuyerInput;
  lines: ZatcaInvoiceLineInput[];
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
}
