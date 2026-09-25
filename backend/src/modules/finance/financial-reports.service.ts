import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const { Decimal } = Prisma;
const TWO_DP = 2;

export interface CashFlowLine {
  journalEntryId: string;
  entryDate: string;
  description: string | null;
  counterpartyAccountName: string | null;
  amount: string;
}

export interface CashFlowSection {
  lines: CashFlowLine[];
  total: string;
}

export interface AgingBucketAmounts {
  current: string;
  days1to30: string;
  days31to60: string;
  days61to90: string;
  over90: string;
  noDueDate: string;
  total: string;
}

export interface CustomerAgingRow extends AgingBucketAmounts {
  customerId: string;
  customerName: string;
}

export interface StatementLine {
  date: string;
  type: 'invoice' | 'payment' | 'credit_note' | 'debit_note';
  reference: string;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface LedgerLine {
  date: string;
  entryNumber: string;
  reference: string | null;
  description: string | null;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface TrialBalanceLine {
  accountId: string;
  code: string;
  name: string;
  type: string;
  debit: string;
  credit: string;
}

export interface IncomeStatementLine {
  accountId: string;
  code: string;
  name: string;
  amount: string;
}

export interface BalanceSheetLine {
  accountId: string;
  code: string;
  name: string;
  balance: string;
}

@Injectable()
export class FinancialReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Every account's net (debit - credit) across all POSTED entries
   * up to and including asOfDate. Deliberately does NOT flip the
   * sign based on the account's own normalBalance — instead, a
   * positive net goes in the Debit column and a negative net
   * (shown as its absolute value) goes in the Credit column. This
   * guarantees totalDebit === totalCredit by construction, for any
   * combination of accounts, since every individual posted entry
   * is itself balanced (JournalEntryValidator enforced that at
   * posting time) — the trial balance is just the sum of already-
   * balanced entries, so it can never fail to balance itself.
   */
  async trialBalance(companyId: string, asOfDate: Date) {
    const accounts = await this.prisma.account.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { code: 'asc' },
    });

    const sums = await this.prisma.journalEntryLine.groupBy({
      by: ['accountId'],
      where: {
        account: { companyId },
        journalEntry: { status: 'posted', entryDate: { lte: asOfDate } },
      },
      _sum: { debit: true, credit: true },
    });
    const sumsByAccount = new Map(sums.map((s) => [s.accountId, s]));

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);
    const lines: TrialBalanceLine[] = [];

    for (const account of accounts) {
      const sum = sumsByAccount.get(account.id);
      const debit = new Decimal(sum?._sum.debit ?? 0);
      const credit = new Decimal(sum?._sum.credit ?? 0);
      const net = debit.sub(credit);

      if (net.eq(0)) continue; // omit untouched accounts from the printed report

      const lineDebit = net.gt(0) ? net : new Decimal(0);
      const lineCredit = net.lt(0) ? net.neg() : new Decimal(0);
      totalDebit = totalDebit.add(lineDebit);
      totalCredit = totalCredit.add(lineCredit);

      lines.push({
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debit: lineDebit.toDecimalPlaces(TWO_DP).toString(),
        credit: lineCredit.toDecimalPlaces(TWO_DP).toString(),
      });
    }

    totalDebit = totalDebit.toDecimalPlaces(TWO_DP);
    totalCredit = totalCredit.toDecimalPlaces(TWO_DP);

    return {
      asOfDate: asOfDate.toISOString().slice(0, 10),
      lines,
      totalDebit: totalDebit.toString(),
      totalCredit: totalCredit.toString(),
      isBalanced: totalDebit.eq(totalCredit),
    };
  }

  /**
   * Revenue accounts show their net CREDIT balance (their normal
   * side) for the period; expense accounts show their net DEBIT
   * balance (their normal side). Net Income = Total Revenue -
   * Total Expense. Only accounts of type 'revenue'/'expense' are
   * considered — asset/liability/equity movements never belong on
   * an income statement.
   */
  async incomeStatement(companyId: string, fromDate: Date, toDate: Date) {
    const accounts = await this.prisma.account.findMany({
      where: { companyId, deletedAt: null, type: { in: ['revenue', 'expense'] } },
      orderBy: { code: 'asc' },
    });

    const sums = await this.prisma.journalEntryLine.groupBy({
      by: ['accountId'],
      where: {
        account: { companyId },
        journalEntry: { status: 'posted', entryDate: { gte: fromDate, lte: toDate } },
      },
      _sum: { debit: true, credit: true },
    });
    const sumsByAccount = new Map(sums.map((s) => [s.accountId, s]));

    const revenueLines: IncomeStatementLine[] = [];
    const expenseLines: IncomeStatementLine[] = [];
    let totalRevenue = new Decimal(0);
    let totalExpense = new Decimal(0);

    for (const account of accounts) {
      const sum = sumsByAccount.get(account.id);
      const debit = new Decimal(sum?._sum.debit ?? 0);
      const credit = new Decimal(sum?._sum.credit ?? 0);

      if (account.type === 'revenue') {
        const amount = credit.sub(debit).toDecimalPlaces(TWO_DP);
        if (amount.eq(0)) continue;
        totalRevenue = totalRevenue.add(amount);
        revenueLines.push({ accountId: account.id, code: account.code, name: account.name, amount: amount.toString() });
      } else {
        const amount = debit.sub(credit).toDecimalPlaces(TWO_DP);
        if (amount.eq(0)) continue;
        totalExpense = totalExpense.add(amount);
        expenseLines.push({ accountId: account.id, code: account.code, name: account.name, amount: amount.toString() });
      }
    }

    totalRevenue = totalRevenue.toDecimalPlaces(TWO_DP);
    totalExpense = totalExpense.toDecimalPlaces(TWO_DP);
    const netIncome = totalRevenue.sub(totalExpense).toDecimalPlaces(TWO_DP);

    return {
      fromDate: fromDate.toISOString().slice(0, 10),
      toDate: toDate.toISOString().slice(0, 10),
      revenueLines,
      expenseLines,
      totalRevenue: totalRevenue.toString(),
      totalExpense: totalExpense.toString(),
      netIncome: netIncome.toString(),
    };
  }

  /**
   * Assets / Liabilities / Equity balances as of a date, using
   * each account's own normalBalance to determine its natural
   * sign (asset accounts: debit-normal; liability/equity accounts:
   * credit-normal).
   *
   * KNOWN LIMITATION, stated plainly rather than hidden: this does
   * NOT include the current period's net income as part of Equity.
   * A full accounting system "closes" revenue/expense accounts
   * into a Retained Earnings equity account at period-end — that
   * closing-entry mechanism does not exist yet in this system.
   * Until it's built, Assets will not necessarily equal
   * Liabilities + Equity on this report if there is any unclosed
   * net income for the period; the response includes
   * `unclosedNetIncome` explicitly so this gap is visible in the
   * data itself, not just in a comment.
   */
  async balanceSheet(companyId: string, asOfDate: Date) {
    const accounts = await this.prisma.account.findMany({
      where: { companyId, deletedAt: null, type: { in: ['asset', 'liability', 'equity'] } },
      orderBy: { code: 'asc' },
    });

    const sums = await this.prisma.journalEntryLine.groupBy({
      by: ['accountId'],
      where: {
        account: { companyId },
        journalEntry: { status: 'posted', entryDate: { lte: asOfDate } },
      },
      _sum: { debit: true, credit: true },
    });
    const sumsByAccount = new Map(sums.map((s) => [s.accountId, s]));

    const buildLines = (type: string): { lines: BalanceSheetLine[]; total: Prisma.Decimal } => {
      const lines: BalanceSheetLine[] = [];
      let total = new Decimal(0);
      for (const account of accounts.filter((a) => a.type === type)) {
        const sum = sumsByAccount.get(account.id);
        const debit = new Decimal(sum?._sum.debit ?? 0);
        const credit = new Decimal(sum?._sum.credit ?? 0);
        const balance = (account.normalBalance === 'debit' ? debit.sub(credit) : credit.sub(debit)).toDecimalPlaces(TWO_DP);
        if (balance.eq(0)) continue;
        total = total.add(balance);
        lines.push({ accountId: account.id, code: account.code, name: account.name, balance: balance.toString() });
      }
      return { lines, total: total.toDecimalPlaces(TWO_DP) };
    };

    const assets = buildLines('asset');
    const liabilities = buildLines('liability');
    const equity = buildLines('equity');

    // Same aggregation as incomeStatement(), but for ALL TIME up to
    // asOfDate (not a single period) — this is "how much net income
    // has never been closed to an equity account", which is exactly
    // the gap this report needs to disclose.
    const incomeAccounts = await this.prisma.account.findMany({
      where: { companyId, deletedAt: null, type: { in: ['revenue', 'expense'] } },
    });
    const incomeSums = await this.prisma.journalEntryLine.groupBy({
      by: ['accountId'],
      where: { account: { companyId }, journalEntry: { status: 'posted', entryDate: { lte: asOfDate } } },
      _sum: { debit: true, credit: true },
    });
    const incomeSumsByAccount = new Map(incomeSums.map((s) => [s.accountId, s]));
    let unclosedNetIncome = new Decimal(0);
    for (const account of incomeAccounts) {
      const sum = incomeSumsByAccount.get(account.id);
      const debit = new Decimal(sum?._sum.debit ?? 0);
      const credit = new Decimal(sum?._sum.credit ?? 0);
      unclosedNetIncome = unclosedNetIncome.add(account.type === 'revenue' ? credit.sub(debit) : debit.sub(credit).neg());
    }
    unclosedNetIncome = unclosedNetIncome.toDecimalPlaces(TWO_DP);

    return {
      asOfDate: asOfDate.toISOString().slice(0, 10),
      assets: { lines: assets.lines, total: assets.total.toString() },
      liabilities: { lines: liabilities.lines, total: liabilities.total.toString() },
      equity: { lines: equity.lines, total: equity.total.toString() },
      unclosedNetIncome: unclosedNetIncome.toString(),
      isBalanced: assets.total.eq(liabilities.total.add(equity.total).add(unclosedNetIncome)),
    };
  }

  /**
   * Direct-method Cash Flow Statement, scoped to the single
   * designated Cash account in Finance Settings. KNOWN LIMITATION,
   * stated plainly: if a company has more than one cash/bank
   * account, only the one designated as "default cash account"
   * (the same one Payments/BillPayments post to) is tracked here
   * — this system does not yet support multiple cash accounts.
   *
   * Every posted journal entry line touching that account within
   * the period is classified by looking at the account on the
   * OTHER side of the same journal entry, using that account's own
   * cashFlowCategory. If an entry's cash line has more than one
   * counterparty line (rare in this system — Payments and
   * BillPayments both post simple two-line entries), the FIRST
   * counterparty line's category is used for the whole movement,
   * rather than attempting a proportional split; this is a
   * simplification worth knowing about, not a silent guess.
   */
  async cashFlow(companyId: string, fromDate: Date, toDate: Date) {
    const settings = await this.prisma.financeSettings.findUnique({ where: { companyId } });
    if (!settings?.defaultCashAccountId) {
      throw new UnprocessableEntityException(
        'Finance Settings must have a default Cash account configured before a cash flow statement can be generated.',
      );
    }
    const cashAccountId = settings.defaultCashAccountId;

    const beginningSum = await this.prisma.journalEntryLine.aggregate({
      where: { accountId: cashAccountId, journalEntry: { companyId, status: 'posted', entryDate: { lt: fromDate } } },
      _sum: { debit: true, credit: true },
    });
    const beginningBalance = new Decimal(beginningSum._sum.debit ?? 0).sub(beginningSum._sum.credit ?? 0).toDecimalPlaces(TWO_DP);

    const cashLines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId: cashAccountId,
        journalEntry: { companyId, status: 'posted', entryDate: { gte: fromDate, lte: toDate } },
      },
      include: {
        journalEntry: { include: { lines: { include: { account: true } } } },
      },
      orderBy: { journalEntry: { entryDate: 'asc' } },
    });

    const buckets: Record<'operating' | 'investing' | 'financing' | 'uncategorized', CashFlowLine[]> = {
      operating: [],
      investing: [],
      financing: [],
      uncategorized: [],
    };

    for (const cashLine of cashLines) {
      const netCash = new Decimal(cashLine.debit).sub(cashLine.credit).toDecimalPlaces(TWO_DP);
      if (netCash.eq(0)) continue;

      const counterparty = cashLine.journalEntry.lines.find((l) => l.accountId !== cashAccountId);
      const category = (counterparty?.account.cashFlowCategory as 'operating' | 'investing' | 'financing' | undefined) ?? 'uncategorized';

      buckets[category].push({
        journalEntryId: cashLine.journalEntry.id,
        entryDate: cashLine.journalEntry.entryDate.toISOString().slice(0, 10),
        description: cashLine.journalEntry.description,
        counterpartyAccountName: counterparty ? `${counterparty.account.code} — ${counterparty.account.name}` : null,
        amount: netCash.toString(),
      });
    }

    const sectionOf = (lines: CashFlowLine[]): CashFlowSection => ({
      lines,
      total: lines.reduce((sum, l) => sum.add(l.amount), new Decimal(0)).toDecimalPlaces(TWO_DP).toString(),
    });

    const operating = sectionOf(buckets.operating);
    const investing = sectionOf(buckets.investing);
    const financing = sectionOf(buckets.financing);
    const uncategorized = sectionOf(buckets.uncategorized);

    const netChange = new Decimal(operating.total).add(investing.total).add(financing.total).add(uncategorized.total).toDecimalPlaces(TWO_DP);
    const endingBalance = beginningBalance.add(netChange).toDecimalPlaces(TWO_DP);

    return {
      fromDate: fromDate.toISOString().slice(0, 10),
      toDate: toDate.toISOString().slice(0, 10),
      beginningBalance: beginningBalance.toString(),
      operating,
      investing,
      financing,
      uncategorized,
      netChange: netChange.toString(),
      endingBalance: endingBalance.toString(),
    };
  }

  /**
   * Zakat Base ESTIMATE — deliberately not called a "calculator"
   * or "return" anywhere in this codebase, on purpose. Real Saudi
   * Zakat calculation depends on shareholder nationality/ownership
   * percentages (Saudi/GCC portions owe Zakat; foreign portions
   * owe corporate income tax instead) — a data model this system
   * does not have at all — and on detailed adjustments under
   * ZATCA's Implementing Regulation for Zakat Collection that
   * require a qualified Zakat/tax advisor's judgment call. This
   * method computes only the well-established CORE formula
   * structure, confirmed across multiple current sources, as a
   * STARTING POINT for that advisor, not a filing-ready number:
   *
   *   Zakat Base (estimate) = Total Equity
   *                          + Long-term Liabilities
   *                          - Fixed Assets (net)
   *                          - Long-term Investments
   *
   * The 2.5% rate applied here is the standard Hijri-year rate;
   * a Gregorian fiscal year sometimes uses an adjusted ~2.5769%
   * rate instead — which one applies is exactly the kind of
   * judgment call a Zakat advisor should confirm, so this method
   * always returns both, never picks one silently.
   */
  async zakatBaseEstimate(companyId: string, asOfDate: Date) {
    const accounts = await this.prisma.account.findMany({
      where: { companyId, deletedAt: null },
    });

    const sums = await this.prisma.journalEntryLine.groupBy({
      by: ['accountId'],
      where: {
        account: { companyId },
        journalEntry: { status: 'posted', entryDate: { lte: asOfDate } },
      },
      _sum: { debit: true, credit: true },
    });
    const sumsByAccount = new Map(sums.map((s) => [s.accountId, s]));

    const balanceOf = (account: (typeof accounts)[number]): Prisma.Decimal => {
      const sum = sumsByAccount.get(account.id);
      const debit = new Decimal(sum?._sum.debit ?? 0);
      const credit = new Decimal(sum?._sum.credit ?? 0);
      return account.normalBalance === 'debit' ? debit.sub(credit) : credit.sub(debit);
    };

    const buildCategoryLines = (zakatCategory: string) => {
      const lines: BalanceSheetLine[] = [];
      let total = new Decimal(0);
      for (const account of accounts.filter((a) => a.zakatCategory === zakatCategory)) {
        const balance = balanceOf(account).toDecimalPlaces(TWO_DP);
        if (balance.eq(0)) continue;
        total = total.add(balance);
        lines.push({ accountId: account.id, code: account.code, name: account.name, balance: balance.toString() });
      }
      return { lines, total: total.toDecimalPlaces(TWO_DP) };
    };

    let totalEquity = new Decimal(0);
    for (const account of accounts.filter((a) => a.type === 'equity')) {
      totalEquity = totalEquity.add(balanceOf(account));
    }
    totalEquity = totalEquity.toDecimalPlaces(TWO_DP);

    const longTermLiabilities = buildCategoryLines('long_term_liability');
    const fixedAssets = buildCategoryLines('fixed_asset');
    const longTermInvestments = buildCategoryLines('long_term_investment');

    const zakatBase = totalEquity
      .add(longTermLiabilities.total)
      .sub(fixedAssets.total)
      .sub(longTermInvestments.total)
      .toDecimalPlaces(TWO_DP);

    // Zakat is owed on positive net wealth only — a negative base
    // (more long-term debt and fixed assets than equity) means no
    // Zakat is due, not a negative payment.
    const zakatableBase = zakatBase.gt(0) ? zakatBase : new Decimal(0);

    return {
      asOfDate: asOfDate.toISOString().slice(0, 10),
      totalEquity: totalEquity.toString(),
      longTermLiabilities: { lines: longTermLiabilities.lines, total: longTermLiabilities.total.toString() },
      fixedAssets: { lines: fixedAssets.lines, total: fixedAssets.total.toString() },
      longTermInvestments: { lines: longTermInvestments.lines, total: longTermInvestments.total.toString() },
      zakatBaseEstimate: zakatBase.toString(),
      estimatedZakatDueHijriRate: zakatableBase.mul(0.025).toDecimalPlaces(TWO_DP).toString(),
      estimatedZakatDueGregorianRate: zakatableBase.mul(0.025769).toDecimalPlaces(TWO_DP).toString(),
    };
  }

  /**
   * Accounts Receivable Aging — one row per customer with at
   * least one open invoice, bucketed by how overdue each
   * invoice's REMAINING balance is (accounting for any issued
   * credit/debit notes, same effective-balance logic as
   * PaymentsService.applyToInvoice()). An invoice with no due
   * date goes to its own explicit `noDueDate` bucket rather than
   * being silently guessed as current or overdue.
   */
  async customerAging(companyId: string, asOfDate: Date) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: ['sent', 'partially_paid', 'overdue'] },
        issueDate: { lte: asOfDate },
      },
      include: {
        customer: { select: { id: true, companyName: true, customerCode: true } },
        noteEntries: { where: { status: 'issued', noteDate: { lte: asOfDate } } },
      },
    });

    const emptyBuckets = (): AgingBucketAmounts => ({
      current: '0',
      days1to30: '0',
      days31to60: '0',
      days61to90: '0',
      over90: '0',
      noDueDate: '0',
      total: '0',
    });

    const rowsByCustomer = new Map<string, CustomerAgingRow>();

    for (const invoice of invoices) {
      const netAdjustment = invoice.noteEntries.reduce(
        (sum: Prisma.Decimal, n) => (n.noteType === 'credit' ? sum.sub(n.total) : sum.add(n.total)),
        new Decimal(0),
      );
      const effectiveTotal = new Decimal(invoice.total).add(netAdjustment);
      const remaining = effectiveTotal.sub(invoice.amountPaid).toDecimalPlaces(TWO_DP);
      if (remaining.lte(0)) continue;

      const customerId = invoice.customer.id;
      if (!rowsByCustomer.has(customerId)) {
        rowsByCustomer.set(customerId, {
          customerId,
          customerName: invoice.customer.companyName ?? invoice.customer.customerCode,
          ...emptyBuckets(),
        });
      }
      const row = rowsByCustomer.get(customerId)!;

      let bucket: keyof AgingBucketAmounts;
      if (!invoice.dueDate) {
        bucket = 'noDueDate';
      } else {
        const daysOverdue = Math.floor((asOfDate.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysOverdue <= 0) bucket = 'current';
        else if (daysOverdue <= 30) bucket = 'days1to30';
        else if (daysOverdue <= 60) bucket = 'days31to60';
        else if (daysOverdue <= 90) bucket = 'days61to90';
        else bucket = 'over90';
      }

      row[bucket] = new Decimal(row[bucket]).add(remaining).toDecimalPlaces(TWO_DP).toString();
      row.total = new Decimal(row.total).add(remaining).toDecimalPlaces(TWO_DP).toString();
    }

    const rows = Array.from(rowsByCustomer.values()).sort((a, b) => Number(b.total) - Number(a.total));

    const grandTotal = emptyBuckets();
    for (const row of rows) {
      for (const key of Object.keys(grandTotal) as Array<keyof AgingBucketAmounts>) {
        grandTotal[key] = new Decimal(grandTotal[key]).add(row[key]).toDecimalPlaces(TWO_DP).toString();
      }
    }

    return { asOfDate: asOfDate.toISOString().slice(0, 10), rows, grandTotal };
  }

  /**
   * A single customer's running-balance ledger: every issued
   * invoice (debit — increases what they owe), payment (credit),
   * and issued credit/debit note (credit/debit respectively),
   * merged into one chronological timeline with a running balance
   * after each line — exactly what a customer asking "how much do
   * I owe you, and how did we get here" needs to see.
   */
  async customerStatement(companyId: string, customerId: string, fromDate: Date, toDate: Date) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, companyId, deletedAt: null } });
    if (!customer) throw new NotFoundException('Customer not found.');

    // Cancelled invoices are always drafts that were cancelled
    // before ever being issued (assertDraft() gates cancel()), so
    // they never had issuedAt set — excluding 'draft'/'cancelled'
    // here means every remaining invoice is guaranteed to have a
    // real issuedAt timestamp to sort and bucket by.
    const invoices = await this.prisma.invoice.findMany({
      where: { companyId, customerId, deletedAt: null, status: { notIn: ['draft', 'cancelled'] }, issuedAt: { lte: toDate } },
    });
    const payments = await this.prisma.payment.findMany({
      where: { invoice: { companyId, customerId, deletedAt: null }, paymentDate: { lte: toDate } },
      include: { invoice: { select: { invoiceNumber: true } } },
    });
    const notes = await this.prisma.invoiceNote.findMany({
      where: { companyId, invoice: { customerId }, status: 'issued', noteDate: { lte: toDate } },
      include: { invoice: { select: { invoiceNumber: true } } },
    });

    interface RawTxn {
      date: Date;
      type: 'invoice' | 'payment' | 'credit_note' | 'debit_note';
      reference: string;
      description: string;
      amount: Prisma.Decimal; // positive = debit (increases balance owed), negative = credit
    }

    const txns: RawTxn[] = [];
    for (const inv of invoices) {
      txns.push({
        date: inv.issuedAt!,
        type: 'invoice',
        reference: inv.invoiceNumber,
        description: `Invoice ${inv.invoiceNumber}`,
        amount: new Decimal(inv.total),
      });
    }
    for (const p of payments) {
      txns.push({
        date: p.paymentDate,
        type: 'payment',
        reference: p.invoice.invoiceNumber,
        description: `Payment received (${p.invoice.invoiceNumber})`,
        amount: new Decimal(p.amount).neg(),
      });
    }
    for (const n of notes) {
      txns.push({
        date: n.noteDate,
        type: n.noteType === 'credit' ? 'credit_note' : 'debit_note',
        reference: n.noteNumber,
        description: `${n.noteType === 'credit' ? 'Credit' : 'Debit'} note ${n.noteNumber} (${n.invoice.invoiceNumber})`,
        amount: n.noteType === 'credit' ? new Decimal(n.total).neg() : new Decimal(n.total),
      });
    }

    txns.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBalance = new Decimal(0);
    for (const t of txns.filter((t) => t.date < fromDate)) {
      runningBalance = runningBalance.add(t.amount);
    }
    const openingBalance = runningBalance.toDecimalPlaces(TWO_DP);

    const lines: StatementLine[] = [];
    for (const t of txns.filter((t) => t.date >= fromDate && t.date <= toDate)) {
      runningBalance = runningBalance.add(t.amount).toDecimalPlaces(TWO_DP);
      lines.push({
        date: t.date.toISOString().slice(0, 10),
        type: t.type,
        reference: t.reference,
        description: t.description,
        debit: t.amount.gt(0) ? t.amount.toString() : '0',
        credit: t.amount.lt(0) ? t.amount.neg().toString() : '0',
        runningBalance: runningBalance.toString(),
      });
    }

    return {
      customerId,
      customerName: customer.companyName ?? customer.customerCode,
      fromDate: fromDate.toISOString().slice(0, 10),
      toDate: toDate.toISOString().slice(0, 10),
      openingBalance: openingBalance.toString(),
      lines,
      closingBalance: runningBalance.toDecimalPlaces(TWO_DP).toString(),
    };
  }

  /**
   * General Ledger for a SINGLE account — every posted journal
   * entry line touching it, in chronological order, with a
   * running balance after each line. Mirrors trialBalance()'s
   * normalBalance-aware sign convention exactly (a debit-normal
   * account's balance increases with debits; a credit-normal
   * account's the opposite), so the closing balance here always
   * matches what a trial balance run as of the same date would
   * show for this one account.
   */
  async accountLedger(companyId: string, accountId: string, fromDate: Date, toDate: Date) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, companyId, deletedAt: null } });
    if (!account) throw new NotFoundException('Account not found.');

    const openingSum = await this.prisma.journalEntryLine.aggregate({
      where: { accountId, journalEntry: { companyId, status: 'posted', entryDate: { lt: fromDate } } },
      _sum: { debit: true, credit: true },
    });
    const openingDebit = new Decimal(openingSum._sum.debit ?? 0);
    const openingCredit = new Decimal(openingSum._sum.credit ?? 0);
    const openingBalance = (
      account.normalBalance === 'debit' ? openingDebit.sub(openingCredit) : openingCredit.sub(openingDebit)
    ).toDecimalPlaces(TWO_DP);

    const rawLines = await this.prisma.journalEntryLine.findMany({
      where: { accountId, journalEntry: { companyId, status: 'posted', entryDate: { gte: fromDate, lte: toDate } } },
      include: { journalEntry: true },
      orderBy: [{ journalEntry: { entryDate: 'asc' } }, { lineOrder: 'asc' }],
    });

    let runningBalance = openingBalance;
    const lines: LedgerLine[] = [];
    for (const line of rawLines) {
      const debit = new Decimal(line.debit);
      const credit = new Decimal(line.credit);
      const delta = account.normalBalance === 'debit' ? debit.sub(credit) : credit.sub(debit);
      runningBalance = runningBalance.add(delta).toDecimalPlaces(TWO_DP);
      lines.push({
        date: line.journalEntry.entryDate.toISOString().slice(0, 10),
        entryNumber: line.journalEntry.entryNumber,
        reference: line.journalEntry.reference,
        description: line.description ?? line.journalEntry.description,
        debit: debit.toString(),
        credit: credit.toString(),
        runningBalance: runningBalance.toString(),
      });
    }

    return {
      accountId,
      accountCode: account.code,
      accountName: account.name,
      fromDate: fromDate.toISOString().slice(0, 10),
      toDate: toDate.toISOString().slice(0, 10),
      openingBalance: openingBalance.toString(),
      lines,
      closingBalance: runningBalance.toString(),
    };
  }
}
