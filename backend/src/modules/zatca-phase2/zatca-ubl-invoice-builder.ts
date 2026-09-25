import { Injectable } from '@nestjs/common';
import { escapeXml, ZatcaInvoiceInput } from './zatca-ubl-types';

/**
 * UNVERIFIED AGAINST ZATCA'S XSD/SCHEMATRON RULES — this whole
 * file. What WAS verified during development: every XML string
 * this class can produce is well-formed (checked with the system
 * `xmllint --noout`, not just "looks plausible"). What was NOT
 * verified: whether the exact element set, ordering, and the
 * InvoiceTypeCode `name` attribute's 7-digit meaning match ZATCA's
 * current UBL 2.1 implementation standard and Schematron
 * validation rules — those require ZATCA's own validator or a
 * copy of their XSD, neither available in this environment.
 * Before real use, run output through ZATCA's own compliance
 * check API (see ZatcaApiClient) and fix whatever it flags — that
 * IS the verification step for this file, not a sign of a bug in
 * the approach.
 *
 * The InvoiceTypeCode name attribute below ("0100000" for
 * standard, "0200000" for simplified) reflects ZATCA's documented
 * convention for the two most common invoice subtypes; the other
 * digit positions (third-party billing, nominal, export, summary,
 * self-billing flags) are left at their default '0' — a real
 * deployment needing any of those subtypes must extend this.
 */
@Injectable()
export class ZatcaUblInvoiceBuilder {
  build(input: ZatcaInvoiceInput): string {
    const invoiceTypeName = input.invoiceSubtype === 'standard' ? '0100000' : '0200000';
    const issueDate = input.issueDateTime.toISOString().slice(0, 10);
    const issueTime = input.issueDateTime.toISOString().slice(11, 19);

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"',
      ' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"',
      ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"',
      ' xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">',
      '  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>',
      `  <cbc:ID>${escapeXml(input.invoiceNumber)}</cbc:ID>`,
      `  <cbc:UUID>${escapeXml(input.uuid)}</cbc:UUID>`,
      `  <cbc:IssueDate>${issueDate}</cbc:IssueDate>`,
      `  <cbc:IssueTime>${issueTime}</cbc:IssueTime>`,
      `  <cbc:InvoiceTypeCode name="${invoiceTypeName}">388</cbc:InvoiceTypeCode>`,
      `  <cbc:DocumentCurrencyCode>${escapeXml(input.currencyCode)}</cbc:DocumentCurrencyCode>`,
      `  <cbc:TaxCurrencyCode>${escapeXml(input.currencyCode)}</cbc:TaxCurrencyCode>`,
      '  <cac:AdditionalDocumentReference>',
      '    <cbc:ID>ICV</cbc:ID>',
      `    <cbc:UUID>${input.icv}</cbc:UUID>`,
      '  </cac:AdditionalDocumentReference>',
      '  <cac:AdditionalDocumentReference>',
      '    <cbc:ID>PIH</cbc:ID>',
      '    <cac:Attachment>',
      `      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${escapeXml(input.previousInvoiceHash)}</cbc:EmbeddedDocumentBinaryObject>`,
      '    </cac:Attachment>',
      '  </cac:AdditionalDocumentReference>',
      this.buildSupplierParty(input.seller),
      this.buildCustomerParty(input.buyer),
      '  <cac:TaxTotal>',
      `    <cbc:TaxAmount currencyID="${escapeXml(input.currencyCode)}">${input.taxTotal}</cbc:TaxAmount>`,
      '  </cac:TaxTotal>',
      '  <cac:LegalMonetaryTotal>',
      `    <cbc:LineExtensionAmount currencyID="${escapeXml(input.currencyCode)}">${input.subtotal}</cbc:LineExtensionAmount>`,
      `    <cbc:TaxExclusiveAmount currencyID="${escapeXml(input.currencyCode)}">${input.subtotal}</cbc:TaxExclusiveAmount>`,
      `    <cbc:TaxInclusiveAmount currencyID="${escapeXml(input.currencyCode)}">${input.grandTotal}</cbc:TaxInclusiveAmount>`,
      `    <cbc:PayableAmount currencyID="${escapeXml(input.currencyCode)}">${input.grandTotal}</cbc:PayableAmount>`,
      '  </cac:LegalMonetaryTotal>',
      ...input.lines.map((line, i) => this.buildInvoiceLine(line, i + 1, input.currencyCode)),
      '</Invoice>',
    ].join('\n');
  }

  private buildSupplierParty(seller: ZatcaInvoiceInput['seller']): string {
    return [
      '  <cac:AccountingSupplierParty>',
      '    <cac:Party>',
      '      <cac:PartyIdentification>',
      `        <cbc:ID schemeID="CRN">${escapeXml(seller.vatRegistrationNumber)}</cbc:ID>`,
      '      </cac:PartyIdentification>',
      '      <cac:PostalAddress>',
      `        <cbc:StreetName>${escapeXml(seller.streetName)}</cbc:StreetName>`,
      `        <cbc:BuildingNumber>${escapeXml(seller.buildingNumber)}</cbc:BuildingNumber>`,
      `        <cbc:CityName>${escapeXml(seller.city)}</cbc:CityName>`,
      `        <cbc:PostalZone>${escapeXml(seller.postalCode)}</cbc:PostalZone>`,
      `        <cbc:CountrySubentity>${escapeXml(seller.district)}</cbc:CountrySubentity>`,
      '        <cac:Country>',
      '          <cbc:IdentificationCode>SA</cbc:IdentificationCode>',
      '        </cac:Country>',
      '      </cac:PostalAddress>',
      '      <cac:PartyTaxScheme>',
      `        <cbc:CompanyID>${escapeXml(seller.vatRegistrationNumber)}</cbc:CompanyID>`,
      '        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>',
      '      </cac:PartyTaxScheme>',
      '      <cac:PartyLegalEntity>',
      `        <cbc:RegistrationName>${escapeXml(seller.name)}</cbc:RegistrationName>`,
      '      </cac:PartyLegalEntity>',
      '    </cac:Party>',
      '  </cac:AccountingSupplierParty>',
    ].join('\n');
  }

  private buildCustomerParty(buyer: ZatcaInvoiceInput['buyer']): string {
    const taxScheme = buyer.vatRegistrationNumber
      ? [
          '      <cac:PartyTaxScheme>',
          `        <cbc:CompanyID>${escapeXml(buyer.vatRegistrationNumber)}</cbc:CompanyID>`,
          '        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>',
          '      </cac:PartyTaxScheme>',
        ].join('\n')
      : '';

    return [
      '  <cac:AccountingCustomerParty>',
      '    <cac:Party>',
      taxScheme,
      '      <cac:PartyLegalEntity>',
      `        <cbc:RegistrationName>${escapeXml(buyer.name)}</cbc:RegistrationName>`,
      '      </cac:PartyLegalEntity>',
      '    </cac:Party>',
      '  </cac:AccountingCustomerParty>',
    ]
      .filter((line) => line !== '')
      .join('\n');
  }

  private buildInvoiceLine(line: ZatcaInvoiceInput['lines'][number], id: number, currencyCode: string): string {
    return [
      '  <cac:InvoiceLine>',
      `    <cbc:ID>${id}</cbc:ID>`,
      `    <cbc:InvoicedQuantity>${line.quantity}</cbc:InvoicedQuantity>`,
      `    <cbc:LineExtensionAmount currencyID="${escapeXml(currencyCode)}">${line.lineTotal}</cbc:LineExtensionAmount>`,
      '    <cac:TaxTotal>',
      `      <cbc:TaxAmount currencyID="${escapeXml(currencyCode)}">${line.taxAmount}</cbc:TaxAmount>`,
      '    </cac:TaxTotal>',
      '    <cac:Item>',
      `      <cbc:Name>${escapeXml(line.description)}</cbc:Name>`,
      '      <cac:ClassifiedTaxCategory>',
      `        <cbc:Percent>${line.taxPercent}</cbc:Percent>`,
      '        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>',
      '      </cac:ClassifiedTaxCategory>',
      '    </cac:Item>',
      '    <cac:Price>',
      `      <cbc:PriceAmount currencyID="${escapeXml(currencyCode)}">${line.unitPrice}</cbc:PriceAmount>`,
      '    </cac:Price>',
      '  </cac:InvoiceLine>',
    ].join('\n');
  }
}
