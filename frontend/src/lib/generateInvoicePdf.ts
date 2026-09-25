import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import type { Invoice } from '../types/entities/finance';
import type { CompanyInfo } from '../types/entities/companySettings';

/**
 * Deliberately async (generateQuotationPdf.ts is not) — rendering
 * the ZATCA QR payload into an actual scannable image is itself
 * an async operation (QRCode.toDataURL), and this function awaits
 * it before laying out the rest of the page so the QR is always
 * present on an issued invoice's PDF, never silently skipped.
 *
 * `zatcaQrBase64` is the exact Base64 TLV string ZatcaQrEncoder
 * produced on the backend — encoded here AS-IS into the QR image
 * (a scanning app then base64-decodes and TLV-decodes it; this
 * function does not re-interpret the payload at all). `null` for
 * a draft invoice (which has no ZATCA QR yet) — the PDF still
 * generates, just without a QR section, since a draft is not yet
 * a legal tax invoice.
 *
 * `company` is the LIVE company record (from useCompanyInfo()) —
 * the caller fetches it and passes it in, replacing the old
 * deploy-time VITE_BRAND_* environment variables entirely.
 */
export async function generateInvoicePdf(invoice: Invoice, zatcaQrBase64: string | null, company: CompanyInfo): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 50;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(company.name, marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y += 16;
  const companyLines = [company.address, company.phone, company.email, company.taxNumber ? `Tax No: ${company.taxNumber}` : '']
    .filter((line): line is string => !!line);
  for (const line of companyLines) {
    doc.text(line, marginX, y);
    y += 12;
  }

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', pageWidth - marginX, 50, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoiceNumber, pageWidth - marginX, 68, { align: 'right' });
  doc.text(`Status: ${invoice.status.toUpperCase()}`, pageWidth - marginX, 82, { align: 'right' });
  doc.text(`Issue date: ${invoice.issueDate.slice(0, 10)}`, pageWidth - marginX, 96, { align: 'right' });
  if (invoice.dueDate) {
    doc.text(`Due date: ${invoice.dueDate.slice(0, 10)}`, pageWidth - marginX, 110, { align: 'right' });
  }

  y = Math.max(y, 110) + 30;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Bill To', marginX, y);
  doc.setFont('helvetica', 'normal');
  y += 14;
  const customer = invoice.customer;
  const billToLines = customer
    ? [
        customer.companyName ?? customer.customerCode,
        customer.address,
        [customer.city, customer.country].filter(Boolean).join(', '),
        customer.phone,
        customer.email,
      ].filter((line): line is string => !!line)
    : ['(Customer details unavailable)'];
  for (const line of billToLines) {
    doc.text(line, marginX, y);
    y += 12;
  }

  y += 20;

  const items = invoice.items ?? [];
  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Unit Price', 'Discount', 'Tax', 'Total']],
    body: items.map((item) => [
      item.description,
      item.quantity,
      Number(item.unitPrice).toFixed(2),
      Number(item.discount).toFixed(2),
      Number(item.tax).toFixed(2),
      Number(item.total).toFixed(2),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [30, 42, 74] },
    styles: { fontSize: 9 },
    margin: { left: marginX, right: marginX },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 20;
  let totalsY = finalY + 24;
  const totalsX = pageWidth - marginX - 150;
  const rows: Array<[string, string]> = [
    ['Subtotal', Number(invoice.subtotal).toFixed(2)],
    ['Discount', Number(invoice.discount).toFixed(2)],
    ['Tax', Number(invoice.tax).toFixed(2)],
  ];
  doc.setFontSize(9);
  for (const [label, value] of rows) {
    doc.text(label, totalsX, totalsY);
    doc.text(value, pageWidth - marginX, totalsY, { align: 'right' });
    totalsY += 14;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Total', totalsX, totalsY);
  doc.text(Number(invoice.total).toFixed(2), pageWidth - marginX, totalsY, { align: 'right' });

  if (zatcaQrBase64) {
    const qrImageDataUrl = await QRCode.toDataURL(zatcaQrBase64, { margin: 1, width: 300 });
    const qrSize = 100;
    const qrY = totalsY + 30;
    doc.addImage(qrImageDataUrl, 'PNG', marginX, qrY, qrSize, qrSize);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Scan to verify (ZATCA e-invoicing, Generation Phase)', marginX, qrY + qrSize + 12);
  }

  doc.save(`${invoice.invoiceNumber}.pdf`);
}
