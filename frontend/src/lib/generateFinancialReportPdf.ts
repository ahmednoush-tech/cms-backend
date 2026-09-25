import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TrialBalance, IncomeStatement, BalanceSheet, CashFlowStatement, CashFlowSection, ZakatBaseEstimate, CustomerAgingReport, CustomerStatement, AccountLedger } from '../types/entities/finance';

const MARGIN_X = 40;

/**
 * Shared header for every financial report PDF: company name and
 * a report title/subtitle. Returns the Y position to continue
 * laying out content from, so each report function stays in
 * charge of its own body.
 */
function drawReportHeader(doc: jsPDF, companyName: string, title: string, subtitle: string): number {
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, MARGIN_X, 45);
  doc.setFontSize(16);
  doc.text(title, MARGIN_X, 70);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, MARGIN_X, 88);
  return 110;
}

function drawTotalsBadge(doc: jsPDF, y: number, isBalanced: boolean, balancedLabel: string, notBalancedLabel: string): void {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(isBalanced ? 22 : 180, isBalanced ? 140 : 40, isBalanced ? 60 : 40);
  doc.text(isBalanced ? balancedLabel : notBalancedLabel, MARGIN_X, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
}

export function generateTrialBalancePdf(report: TrialBalance, companyName: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const y = drawReportHeader(doc, companyName, 'Trial Balance', `As of ${report.asOfDate}`);

  autoTable(doc, {
    startY: y,
    head: [['Code', 'Account', 'Debit', 'Credit']],
    body: report.lines.map((line) => [line.code, line.name, Number(line.debit) > 0 ? Number(line.debit).toFixed(2) : '', Number(line.credit) > 0 ? Number(line.credit).toFixed(2) : '']),
    foot: [['', 'Total', Number(report.totalDebit).toFixed(2), Number(report.totalCredit).toFixed(2)]],
    theme: 'grid',
    headStyles: { fillColor: [30, 42, 74] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 9 },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 20;
  drawTotalsBadge(doc, finalY + 24, report.isBalanced, 'Balanced', 'NOT BALANCED — please investigate');

  doc.save(`trial-balance-${report.asOfDate}.pdf`);
}

export function generateIncomeStatementPdf(report: IncomeStatement, companyName: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = drawReportHeader(doc, companyName, 'Income Statement', `${report.fromDate} to ${report.toDate}`);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Revenue', MARGIN_X, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [['Code', 'Account', 'Amount']],
    body: report.revenueLines.map((line) => [line.code, line.name, Number(line.amount).toFixed(2)]),
    foot: [['', 'Total Revenue', Number(report.totalRevenue).toFixed(2)]],
    theme: 'grid',
    headStyles: { fillColor: [30, 42, 74] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 9 },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Expenses', MARGIN_X, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [['Code', 'Account', 'Amount']],
    body: report.expenseLines.map((line) => [line.code, line.name, Number(line.amount).toFixed(2)]),
    foot: [['', 'Total Expense', Number(report.totalExpense).toFixed(2)]],
    theme: 'grid',
    headStyles: { fillColor: [30, 42, 74] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 9 },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 30;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Net Income', MARGIN_X, y);
  doc.text(Number(report.netIncome).toFixed(2), 300, y);

  doc.save(`income-statement-${report.fromDate}-to-${report.toDate}.pdf`);
}

export function generateBalanceSheetPdf(report: BalanceSheet, companyName: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = drawReportHeader(doc, companyName, 'Balance Sheet', `As of ${report.asOfDate}`);

  const sections: Array<[string, typeof report.assets]> = [
    ['Assets', report.assets],
    ['Liabilities', report.liabilities],
    ['Equity', report.equity],
  ];

  for (const [label, section] of sections) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(label, MARGIN_X, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [['Code', 'Account', 'Balance']],
      body: section.lines.map((line) => [line.code, line.name, Number(line.balance).toFixed(2)]),
      foot: [['', `Total ${label}`, Number(section.total).toFixed(2)]],
      theme: 'grid',
      headStyles: { fillColor: [30, 42, 74] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      margin: { left: MARGIN_X, right: MARGIN_X },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 30;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Net income not yet closed to equity (see note below):', MARGIN_X, y);
  doc.text(Number(report.unclosedNetIncome).toFixed(2), 320, y);
  y += 20;

  drawTotalsBadge(doc, y, report.isBalanced, 'Balanced (Assets = Liabilities + Equity + Unclosed Net Income)', 'NOT BALANCED — please investigate');
  y += 20;

  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'Note: this system does not yet close revenue/expense accounts into Retained Earnings at period-end,',
    MARGIN_X,
    y,
  );
  doc.text('so unclosed net income is shown separately rather than folded into Equity above.', MARGIN_X, y + 12);

  doc.save(`balance-sheet-${report.asOfDate}.pdf`);
}

export function generateCashFlowPdf(report: CashFlowStatement, companyName: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = drawReportHeader(doc, companyName, 'Cash Flow Statement', `${report.fromDate} to ${report.toDate}`);

  doc.setFontSize(9);
  doc.text('Beginning Cash Balance', MARGIN_X, y);
  doc.text(Number(report.beginningBalance).toFixed(2), 300, y);
  y += 24;

  const sections: Array<[string, CashFlowSection]> = [
    ['Operating Activities', report.operating],
    ['Investing Activities', report.investing],
    ['Financing Activities', report.financing],
    ...(report.uncategorized.lines.length > 0 ? ([['Uncategorized', report.uncategorized]] as Array<[string, CashFlowSection]>) : []),
  ];

  for (const [label, section] of sections) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(label, MARGIN_X, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Account / Description', 'Amount']],
      body: section.lines.map((line) => [line.entryDate, line.counterpartyAccountName ?? line.description ?? '', Number(line.amount).toFixed(2)]),
      foot: [['', `Total ${label}`, Number(section.total).toFixed(2)]],
      theme: 'grid',
      headStyles: { fillColor: [30, 42, 74] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      margin: { left: MARGIN_X, right: MARGIN_X },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 30;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Net Change in Cash', MARGIN_X, y);
  doc.text(Number(report.netChange).toFixed(2), 300, y);
  y += 20;
  doc.text('Ending Cash Balance', MARGIN_X, y);
  doc.text(Number(report.endingBalance).toFixed(2), 300, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Note: scoped to the single default Cash account configured in Finance Settings.', MARGIN_X, y);
  doc.text('If your company has more than one bank/cash account, only that one is reflected here.', MARGIN_X, y + 12);

  doc.save(`cash-flow-${report.fromDate}-to-${report.toDate}.pdf`);
}

/**
 * Prints the same disclaimer that leads the on-screen page, in
 * the SAME prominent position — first thing after the header,
 * before any numbers — so a printed/shared copy carries the exact
 * same warning a viewer on-screen would see, not a weaker one.
 */
export function generateZakatBaseEstimatePdf(report: ZakatBaseEstimate, companyName: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = drawReportHeader(doc, companyName, 'Zakat Base Estimate', `As of ${report.asOfDate}`);

  doc.setDrawColor(200, 40, 40);
  doc.setLineWidth(1.5);
  doc.rect(MARGIN_X, y, 515, 55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(180, 30, 30);
  doc.text('NOT A ZAKAT RETURN — ESTIMATE ONLY, FOR DISCUSSION WITH YOUR ZAKAT ADVISOR', MARGIN_X + 8, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('This does not account for shareholder ownership structure (Saudi/GCC vs foreign) or the detailed', MARGIN_X + 8, y + 30);
  doc.text('adjustments required under ZATCA\u2019s Implementing Regulation. Do not file this figure directly.', MARGIN_X + 8, y + 42);
  doc.setTextColor(0, 0, 0);
  y += 75;

  const rows: Array<[string, string]> = [
    ['Total Equity', Number(report.totalEquity).toFixed(2)],
    ['+ Long-term Liabilities', Number(report.longTermLiabilities.total).toFixed(2)],
    ['- Fixed Assets (net)', Number(report.fixedAssets.total).toFixed(2)],
    ['- Long-term Investments', Number(report.longTermInvestments.total).toFixed(2)],
  ];
  doc.setFontSize(9);
  for (const [label, value] of rows) {
    doc.text(label, MARGIN_X, y);
    doc.text(value, 400, y);
    y += 16;
  }

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Zakat Base Estimate', MARGIN_X, y);
  doc.text(Number(report.zakatBaseEstimate).toFixed(2), 400, y);
  y += 30;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Estimated Zakat Due (2.5% — Hijri-year rate)', MARGIN_X, y);
  doc.text(Number(report.estimatedZakatDueHijriRate).toFixed(2), 400, y);
  y += 16;
  doc.text('Estimated Zakat Due (2.5769% — Gregorian-year adjusted rate)', MARGIN_X, y);
  doc.text(Number(report.estimatedZakatDueGregorianRate).toFixed(2), 400, y);

  doc.save(`zakat-base-estimate-${report.asOfDate}.pdf`);
}

export function generateCustomerAgingPdf(report: CustomerAgingReport, companyName: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const y = drawReportHeader(doc, companyName, 'Customer Aging Report', `As of ${report.asOfDate}`);

  autoTable(doc, {
    startY: y,
    head: [['Customer', 'Current', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days', 'No Due Date', 'Total']],
    body: report.rows.map((r) => [
      r.customerName,
      Number(r.current).toFixed(2),
      Number(r.days1to30).toFixed(2),
      Number(r.days31to60).toFixed(2),
      Number(r.days61to90).toFixed(2),
      Number(r.over90).toFixed(2),
      Number(r.noDueDate).toFixed(2),
      Number(r.total).toFixed(2),
    ]),
    foot: [[
      'Grand Total',
      Number(report.grandTotal.current).toFixed(2),
      Number(report.grandTotal.days1to30).toFixed(2),
      Number(report.grandTotal.days31to60).toFixed(2),
      Number(report.grandTotal.days61to90).toFixed(2),
      Number(report.grandTotal.over90).toFixed(2),
      Number(report.grandTotal.noDueDate).toFixed(2),
      Number(report.grandTotal.total).toFixed(2),
    ]],
    theme: 'grid',
    headStyles: { fillColor: [30, 42, 74] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 8 },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  doc.save(`customer-aging-${report.asOfDate}.pdf`);
}

export function generateCustomerStatementPdf(statement: CustomerStatement, companyName: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const y = drawReportHeader(doc, companyName, 'Customer Statement of Account', `${statement.customerName} — ${statement.fromDate} to ${statement.toDate}`);

  const typeLabels: Record<string, string> = { invoice: 'Invoice', payment: 'Payment', credit_note: 'Credit Note', debit_note: 'Debit Note' };

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Type', 'Reference', 'Debit', 'Credit', 'Balance']],
    body: [
      ['', '', 'Opening Balance', '', '', Number(statement.openingBalance).toFixed(2)],
      ...statement.lines.map((l) => [
        l.date,
        typeLabels[l.type] ?? l.type,
        l.reference,
        Number(l.debit) > 0 ? Number(l.debit).toFixed(2) : '',
        Number(l.credit) > 0 ? Number(l.credit).toFixed(2) : '',
        Number(l.runningBalance).toFixed(2),
      ]),
    ],
    foot: [['', '', 'Closing Balance', '', '', Number(statement.closingBalance).toFixed(2)]],
    theme: 'grid',
    headStyles: { fillColor: [30, 42, 74] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 9 },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  doc.save(`statement-${statement.customerName.replace(/\s+/g, '-')}-${statement.toDate}.pdf`);
}

export function generateAccountLedgerPdf(ledger: AccountLedger, companyName: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const y = drawReportHeader(doc, companyName, 'General Ledger', `${ledger.accountCode} — ${ledger.accountName} — ${ledger.fromDate} to ${ledger.toDate}`);

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Entry #', 'Reference', 'Description', 'Debit', 'Credit', 'Balance']],
    body: [
      ['', '', '', 'Opening Balance', '', '', Number(ledger.openingBalance).toFixed(2)],
      ...ledger.lines.map((l) => [
        l.date,
        l.entryNumber,
        l.reference ?? '',
        l.description ?? '',
        Number(l.debit) > 0 ? Number(l.debit).toFixed(2) : '',
        Number(l.credit) > 0 ? Number(l.credit).toFixed(2) : '',
        Number(l.runningBalance).toFixed(2),
      ]),
    ],
    foot: [['', '', '', 'Closing Balance', '', '', Number(ledger.closingBalance).toFixed(2)]],
    theme: 'grid',
    headStyles: { fillColor: [30, 42, 74] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 8 },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  doc.save(`ledger-${ledger.accountCode}-${ledger.toDate}.pdf`);
}
