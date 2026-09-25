import { execFileSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ZatcaUblInvoiceBuilder } from './zatca-ubl-invoice-builder';
import { ZatcaInvoiceInput } from './zatca-ubl-types';

/** Shells out to the real xmllint binary — the point of this helper is to prove ACTUAL well-formedness, not just "the string looks like XML". */
function assertWellFormed(xml: string) {
  const path = join(tmpdir(), `zatca-ubl-test-${Date.now()}-${Math.random()}.xml`);
  writeFileSync(path, xml);
  try {
    execFileSync('xmllint', ['--noout', path]);
  } finally {
    unlinkSync(path);
  }
}

describe('ZatcaUblInvoiceBuilder', () => {
  const builder = new ZatcaUblInvoiceBuilder();

  const baseInput: ZatcaInvoiceInput = {
    uuid: 'a1b2c3d4-1234-5678-9abc-def012345678',
    invoiceNumber: 'INV-2026-0001',
    issueDateTime: new Date('2026-06-15T14:30:00Z'),
    invoiceSubtype: 'standard',
    currencyCode: 'SAR',
    icv: 42,
    previousInvoiceHash: 'NWZlY2ViNjZmZmM4NmYzOA==',
    seller: {
      name: 'Acme Trading Co.',
      vatRegistrationNumber: '300000000000003',
      streetName: 'King Fahd Rd',
      buildingNumber: '1234',
      district: 'Al Olaya',
      city: 'Riyadh',
      postalCode: '12211',
    },
    buyer: { name: 'Test Buyer LLC', vatRegistrationNumber: '300000000000099' },
    lines: [{ description: 'Widget', quantity: '5.00', unitPrice: '100.00', lineTotal: '500.00', taxAmount: '75.00', taxPercent: '15.00' }],
    subtotal: '500.00',
    taxTotal: '75.00',
    grandTotal: '575.00',
  };

  it('produces WELL-FORMED XML for a standard (B2B) invoice — verified with the real xmllint binary, not a mock', () => {
    const xml = builder.build(baseInput);
    expect(() => assertWellFormed(xml)).not.toThrow();
  });

  it('produces WELL-FORMED XML for a simplified (B2C) invoice with no buyer VAT number', () => {
    const xml = builder.build({ ...baseInput, invoiceSubtype: 'simplified', buyer: { name: 'Walk-in Customer' } });
    expect(() => assertWellFormed(xml)).not.toThrow();
  });

  it('produces WELL-FORMED XML with multiple invoice lines', () => {
    const xml = builder.build({
      ...baseInput,
      lines: [
        { description: 'Widget A', quantity: '2.00', unitPrice: '50.00', lineTotal: '100.00', taxAmount: '15.00', taxPercent: '15.00' },
        { description: 'Widget B', quantity: '3.00', unitPrice: '150.00', lineTotal: '450.00', taxAmount: '67.50', taxPercent: '15.00' },
      ],
    });
    expect(() => assertWellFormed(xml)).not.toThrow();
  });

  it('sets InvoiceTypeCode name to 0100000 for standard and 0200000 for simplified', () => {
    const standardXml = builder.build({ ...baseInput, invoiceSubtype: 'standard' });
    const simplifiedXml = builder.build({ ...baseInput, invoiceSubtype: 'simplified' });

    expect(standardXml).toContain('name="0100000"');
    expect(simplifiedXml).toContain('name="0200000"');
  });

  it('escapes an ampersand in the seller name — unescaped, this would break XML well-formedness', () => {
    const xml = builder.build({ ...baseInput, seller: { ...baseInput.seller, name: 'Acme & Sons' } });

    expect(xml).toContain('Acme &amp; Sons');
    expect(xml).not.toContain('Acme & Sons<');
    expect(() => assertWellFormed(xml)).not.toThrow();
  });

  it('escapes angle brackets in a line item description', () => {
    const xml = builder.build({ ...baseInput, lines: [{ ...baseInput.lines[0], description: 'Widget <Deluxe>' }] });

    expect(xml).toContain('Widget &lt;Deluxe&gt;');
    expect(() => assertWellFormed(xml)).not.toThrow();
  });

  it('includes the ICV and PIH as AdditionalDocumentReference entries', () => {
    const xml = builder.build(baseInput);

    expect(xml).toContain('<cbc:ID>ICV</cbc:ID>');
    expect(xml).toContain('<cbc:UUID>42</cbc:UUID>');
    expect(xml).toContain('<cbc:ID>PIH</cbc:ID>');
    expect(xml).toContain(baseInput.previousInvoiceHash);
  });

  it('omits the buyer PartyTaxScheme block entirely when no buyer VAT number is given (not an empty tag)', () => {
    const xml = builder.build({ ...baseInput, buyer: { name: 'Walk-in Customer' } });

    expect(xml).not.toContain('PartyTaxScheme');
  });

  it('includes one InvoiceLine per line item, numbered sequentially from 1', () => {
    const xml = builder.build({
      ...baseInput,
      lines: [
        { description: 'A', quantity: '1.00', unitPrice: '10.00', lineTotal: '10.00', taxAmount: '1.50', taxPercent: '15.00' },
        { description: 'B', quantity: '1.00', unitPrice: '20.00', lineTotal: '20.00', taxAmount: '3.00', taxPercent: '15.00' },
        { description: 'C', quantity: '1.00', unitPrice: '30.00', lineTotal: '30.00', taxAmount: '4.50', taxPercent: '15.00' },
      ],
    });

    const lineIds = [...xml.matchAll(/<cac:InvoiceLine>\s*<cbc:ID>(\d+)<\/cbc:ID>/g)].map((m) => m[1]);
    expect(lineIds).toEqual(['1', '2', '3']);
  });
});
