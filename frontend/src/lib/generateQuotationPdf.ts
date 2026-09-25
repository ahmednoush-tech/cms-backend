import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Quotation } from '../types/entities/quotation';
import type { CompanyInfo } from '../types/entities/companySettings';

/**
 * Client-side PDF generation — deliberately NOT a backend
 * endpoint. The data this needs (quotation + its nested customer)
 * is already returned in full by the existing GET /quotations/:id
 * response (confirmed this session — the backend's own Prisma
 * query already does `include: { customer: true }`; the frontend
 * type just hadn't modeled that field until now). Generating the
 * PDF in the browser avoids adding any new backend dependency
 * (e.g. Puppeteer, which would need a full Chromium binary on the
 * VPS) and avoids a new authenticated-file-download endpoint
 * entirely — the user already has everything needed on screen.
 *
 * Uses jsPDF + jspdf-autotable — both pure-JS, no native/binary
 * dependency, safe for any deployment target.
 *
 * `company` is the LIVE company record (from useCompanyInfo(),
 * fetched via GET /company-settings) — the caller is responsible
 * for fetching it and passing it in, rather than this function
 * reading the deploy-time VITE_BRAND_* environment variables it
 * used to. Editing company info in Settings now actually changes
 * what prints on the next PDF, with no rebuild required.
 */

function formatMoney(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : value;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

export function generateQuotationPdf(quotation: Quotation, company: CompanyInfo): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 50;

  // ---- Header: company details ----
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

  // ---- Document title + number, right-aligned ----
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('QUOTATION', pageWidth - marginX, 50, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(quotation.quotationNumber, pageWidth - marginX, 68, { align: 'right' });
  doc.text(`Status: ${quotation.status.toUpperCase()}`, pageWidth - marginX, 82, { align: 'right' });
  doc.text(`Valid until: ${formatDate(quotation.validUntil)}`, pageWidth - marginX, 96, { align: 'right' });

  y = Math.max(y, 96) + 30;

  // ---- Bill To ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Bill To', marginX, y);
  doc.setFont('helvetica', 'normal');
  y += 14;
  const customer = quotation.customer;
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

  // ---- Line items table ----
  const items = quotation.items ?? [];
  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Unit Price', 'Discount', 'Tax', 'Total']],
    body: items.map((item) => [
      item.description,
      item.quantity,
      formatMoney(item.unitPrice),
      formatMoney(item.discount),
      formatMoney(item.tax),
      formatMoney(item.total),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [30, 42, 74] },
    styles: { fontSize: 9 },
    margin: { left: marginX, right: marginX },
  });

  // ---- Totals ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 20;
  let totalsY = finalY + 24;
  const totalsX = pageWidth - marginX - 150;
  const rows: Array<[string, string]> = [
    ['Subtotal', formatMoney(quotation.subtotal)],
    ['Discount', formatMoney(quotation.discount)],
    ['Tax', formatMoney(quotation.tax)],
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
  doc.text(formatMoney(quotation.total), pageWidth - marginX, totalsY, { align: 'right' });

  doc.save(`${quotation.quotationNumber}.pdf`);
}
