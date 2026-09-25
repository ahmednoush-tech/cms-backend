import QRCode from 'qrcode';
import type { Invoice } from '../types/entities/finance';
import type { CompanyInfo } from '../types/entities/companySettings';
import { renderHtmlToPdf, createArabicDocumentContainer } from './pdfHtmlRenderer';

function formatMoney(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : value;
}

const STATUS_LABELS_AR: Record<string, string> = {
  draft: 'مسودة',
  sent: 'مُرسَلة',
  partially_paid: 'مدفوعة جزئيًا',
  paid: 'مدفوعة',
  overdue: 'متأخرة',
  cancelled: 'مُلغاة',
};

/**
 * Deliberately async — same reason as the English generator: the
 * ZATCA QR must actually render as a scannable image before the
 * document is finalized, never silently skipped.
 */
export async function generateInvoicePdfArabic(invoice: Invoice, zatcaQrBase64: string | null, company: CompanyInfo): Promise<void> {
  const customer = invoice.customer;
  const items = invoice.items ?? [];

  const billToLines = customer
    ? [
        customer.companyName ?? customer.customerCode,
        customer.address,
        [customer.city, customer.country].filter(Boolean).join('، '),
        customer.phone,
        customer.email,
      ].filter((line): line is string => !!line)
    : ['(بيانات العميل غير متاحة)'];

  const qrImageDataUrl = zatcaQrBase64 ? await QRCode.toDataURL(zatcaQrBase64, { margin: 1, width: 300 }) : null;

  await renderHtmlToPdf(() => {
    const el = createArabicDocumentContainer();
    el.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px;">
        <div>
          <div style="font-size:20px; font-weight:bold;">${company.name}</div>
          ${[company.address, company.phone, company.email, company.taxNumber ? `الرقم الضريبي: ${company.taxNumber}` : '']
            .filter(Boolean)
            .map((line) => `<div style="font-size:11px; color:#444;">${line}</div>`)
            .join('')}
        </div>
        <div style="text-align:left;">
          <div style="font-size:22px; font-weight:bold;">فاتورة ضريبية</div>
          <div style="font-size:12px; margin-top:6px;">${invoice.invoiceNumber}</div>
          <div style="font-size:12px;">الحالة: ${STATUS_LABELS_AR[invoice.status] ?? invoice.status}</div>
          <div style="font-size:12px;">تاريخ الإصدار: ${invoice.issueDate.slice(0, 10)}</div>
          ${invoice.dueDate ? `<div style="font-size:12px;">تاريخ الاستحقاق: ${invoice.dueDate.slice(0, 10)}</div>` : ''}
        </div>
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-weight:bold; font-size:13px; margin-bottom:6px;">مُرسَلة إلى</div>
        ${billToLines.map((line) => `<div style="font-size:12px;">${line}</div>`).join('')}
      </div>

      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:#1e2a4a; color:#fff;">
            <th style="padding:8px; text-align:right;">الوصف</th>
            <th style="padding:8px; text-align:right;">الكمية</th>
            <th style="padding:8px; text-align:right;">سعر الوحدة</th>
            <th style="padding:8px; text-align:right;">الخصم</th>
            <th style="padding:8px; text-align:right;">الضريبة</th>
            <th style="padding:8px; text-align:right;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
            <tr style="border-bottom:1px solid #ddd;">
              <td style="padding:8px;">${item.description}</td>
              <td style="padding:8px;">${item.quantity}</td>
              <td style="padding:8px;">${formatMoney(item.unitPrice)}</td>
              <td style="padding:8px;">${formatMoney(item.discount)}</td>
              <td style="padding:8px;">${formatMoney(item.tax)}</td>
              <td style="padding:8px;">${formatMoney(item.total)}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>

      <div style="display:flex; justify-content:flex-start; margin-top:20px;">
        <div style="width:220px; font-size:12px;">
          <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>الإجمالي الفرعي</span><span>${formatMoney(invoice.subtotal)}</span></div>
          <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>الخصم</span><span>${formatMoney(invoice.discount)}</span></div>
          <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>الضريبة</span><span>${formatMoney(invoice.tax)}</span></div>
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-top:2px solid #1e2a4a; font-weight:bold; font-size:14px;"><span>الإجمالي</span><span>${formatMoney(invoice.total)}</span></div>
        </div>
      </div>

      ${
        qrImageDataUrl
          ? `<div style="margin-top:24px;">
              <img src="${qrImageDataUrl}" width="100" height="100" />
              <div style="font-size:10px; color:#555; margin-top:6px;">امسح للتحقق (فوترة زاتكا الإلكترونية، مرحلة الإصدار)</div>
            </div>`
          : ''
      }
    `;
    return el;
  }, `${invoice.invoiceNumber}-ar.pdf`);
}
