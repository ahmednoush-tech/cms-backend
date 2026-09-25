import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { FinancialReportsService } from './financial-reports.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('FinancialReportsService', () => {
  let service: FinancialReportsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      account: { findMany: jest.fn(), findFirst: jest.fn() },
      journalEntryLine: { groupBy: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
      financeSettings: { findUnique: jest.fn() },
      invoice: { findMany: jest.fn() },
      payment: { findMany: jest.fn() },
      invoiceNote: { findMany: jest.fn() },
      customer: { findFirst: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [FinancialReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(FinancialReportsService);
  });

  describe('trialBalance', () => {
    it('always balances (totalDebit === totalCredit) for a mix of debit-heavy and credit-heavy accounts', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'cash', code: '1000', name: 'Cash', type: 'asset' },
        { id: 'ar', code: '1100', name: 'Accounts Receivable', type: 'asset' },
        { id: 'revenue', code: '4000', name: 'Revenue', type: 'revenue' },
      ]);
      prisma.journalEntryLine.groupBy.mockResolvedValue([
        { accountId: 'cash', _sum: { debit: 1000, credit: 0 } },
        { accountId: 'ar', _sum: { debit: 500, credit: 0 } },
        { accountId: 'revenue', _sum: { debit: 0, credit: 1500 } },
      ]);

      const result = await service.trialBalance('company-1', new Date('2026-06-30'));

      expect(result.isBalanced).toBe(true);
      expect(result.totalDebit).toBe('1500');
      expect(result.totalCredit).toBe('1500');
    });

    it('omits accounts with a net-zero balance from the printed lines', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'cash', code: '1000', name: 'Cash', type: 'asset' },
        { id: 'unused', code: '1200', name: 'Unused Account', type: 'asset' },
      ]);
      prisma.journalEntryLine.groupBy.mockResolvedValue([
        { accountId: 'cash', _sum: { debit: 100, credit: 0 } },
        { accountId: 'unused', _sum: { debit: 50, credit: 50 } },
      ]);

      const result = await service.trialBalance('company-1', new Date('2026-06-30'));

      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].code).toBe('1000');
    });

    it('places a negative net (credit-side) balance in the credit column, not as a negative debit', async () => {
      prisma.account.findMany.mockResolvedValue([{ id: 'cash', code: '1000', name: 'Cash', type: 'asset' }]);
      prisma.journalEntryLine.groupBy.mockResolvedValue([{ accountId: 'cash', _sum: { debit: 100, credit: 300 } }]);

      const result = await service.trialBalance('company-1', new Date('2026-06-30'));

      expect(result.lines[0].debit).toBe('0');
      expect(result.lines[0].credit).toBe('200');
    });

    it('returns an empty, still-balanced report when there are no posted entries at all', async () => {
      prisma.account.findMany.mockResolvedValue([{ id: 'cash', code: '1000', name: 'Cash', type: 'asset' }]);
      prisma.journalEntryLine.groupBy.mockResolvedValue([]);

      const result = await service.trialBalance('company-1', new Date('2026-06-30'));

      expect(result.lines).toHaveLength(0);
      expect(result.totalDebit).toBe('0');
      expect(result.totalCredit).toBe('0');
      expect(result.isBalanced).toBe(true);
    });
  });

  describe('incomeStatement', () => {
    it('computes net income as total revenue minus total expense', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'revenue', code: '4000', name: 'Revenue', type: 'revenue' },
        { id: 'expense', code: '5000', name: 'Expenses', type: 'expense' },
      ]);
      prisma.journalEntryLine.groupBy.mockResolvedValue([
        { accountId: 'revenue', _sum: { debit: 0, credit: 5000 } },
        { accountId: 'expense', _sum: { debit: 3000, credit: 0 } },
      ]);

      const result = await service.incomeStatement('company-1', new Date('2026-01-01'), new Date('2026-12-31'));

      expect(result.totalRevenue).toBe('5000');
      expect(result.totalExpense).toBe('3000');
      expect(result.netIncome).toBe('2000');
    });

    it('scopes the account query to revenue/expense only', async () => {
      prisma.account.findMany.mockResolvedValue([{ id: 'revenue', code: '4000', name: 'Revenue', type: 'revenue' }]);
      prisma.journalEntryLine.groupBy.mockResolvedValue([{ accountId: 'revenue', _sum: { debit: 0, credit: 1000 } }]);

      await service.incomeStatement('company-1', new Date('2026-01-01'), new Date('2026-12-31'));

      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ type: { in: ['revenue', 'expense'] } }) }),
      );
    });

    it('can report a net loss (negative net income) without throwing', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'revenue', code: '4000', name: 'Revenue', type: 'revenue' },
        { id: 'expense', code: '5000', name: 'Expenses', type: 'expense' },
      ]);
      prisma.journalEntryLine.groupBy.mockResolvedValue([
        { accountId: 'revenue', _sum: { debit: 0, credit: 1000 } },
        { accountId: 'expense', _sum: { debit: 4000, credit: 0 } },
      ]);

      const result = await service.incomeStatement('company-1', new Date('2026-01-01'), new Date('2026-12-31'));

      expect(result.netIncome).toBe('-3000');
    });
  });

  describe('balanceSheet', () => {
    it('reports unclosedNetIncome and factors it into isBalanced', async () => {
      prisma.account.findMany
        .mockResolvedValueOnce([
          { id: 'cash', code: '1000', name: 'Cash', type: 'asset', normalBalance: 'debit' },
          { id: 'ap', code: '2000', name: 'Accounts Payable', type: 'liability', normalBalance: 'credit' },
          { id: 'capital', code: '3000', name: 'Owner Capital', type: 'equity', normalBalance: 'credit' },
        ])
        .mockResolvedValueOnce([
          { id: 'revenue', code: '4000', name: 'Revenue', type: 'revenue' },
          { id: 'expense', code: '5000', name: 'Expenses', type: 'expense' },
        ]);

      prisma.journalEntryLine.groupBy
        .mockResolvedValueOnce([
          { accountId: 'cash', _sum: { debit: 5000, credit: 0 } },
          { accountId: 'ap', _sum: { debit: 0, credit: 2000 } },
          { accountId: 'capital', _sum: { debit: 0, credit: 1000 } },
        ])
        .mockResolvedValueOnce([
          { accountId: 'revenue', _sum: { debit: 0, credit: 3000 } },
          { accountId: 'expense', _sum: { debit: 1000, credit: 0 } },
        ]);

      const result = await service.balanceSheet('company-1', new Date('2026-06-30'));

      expect(result.assets.total).toBe('5000');
      expect(result.liabilities.total).toBe('2000');
      expect(result.equity.total).toBe('1000');
      expect(result.unclosedNetIncome).toBe('2000');
      expect(result.isBalanced).toBe(true);
    });

    it('reports isBalanced: false if the underlying data is genuinely inconsistent', async () => {
      prisma.account.findMany
        .mockResolvedValueOnce([{ id: 'cash', code: '1000', name: 'Cash', type: 'asset', normalBalance: 'debit' }])
        .mockResolvedValueOnce([]);
      prisma.journalEntryLine.groupBy
        .mockResolvedValueOnce([{ accountId: 'cash', _sum: { debit: 9999, credit: 0 } }])
        .mockResolvedValueOnce([]);

      const result = await service.balanceSheet('company-1', new Date('2026-06-30'));

      expect(result.assets.total).toBe('9999');
      expect(result.liabilities.total).toBe('0');
      expect(result.equity.total).toBe('0');
      expect(result.unclosedNetIncome).toBe('0');
      expect(result.isBalanced).toBe(false);
    });
  });

  describe('cashFlow', () => {
    it('rejects when Finance Settings has no default cash account configured', async () => {
      prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: null });

      await expect(service.cashFlow('company-1', new Date('2026-01-01'), new Date('2026-12-31'))).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('classifies a cash movement by the COUNTERPARTY account\'s cashFlowCategory, not the cash account\'s own type', async () => {
      // This is the exact scenario the whole feature exists for:
      // two liability-type counterparties that must land in
      // different sections because one is tagged operating and
      // the other financing.
      prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'cash-1' });
      prisma.journalEntryLine.aggregate.mockResolvedValue({ _sum: { debit: 0, credit: 0 } });
      prisma.journalEntryLine.findMany.mockResolvedValue([
        {
          debit: 0,
          credit: 500,
          journalEntry: {
            id: 'je-1',
            entryDate: new Date('2026-03-01'),
            description: 'Paid supplier',
            lines: [
              { accountId: 'cash-1', account: { code: '1000', name: 'Cash', cashFlowCategory: null } },
              { accountId: 'ap-1', account: { code: '2000', name: 'Accounts Payable', cashFlowCategory: 'operating' } },
            ],
          },
        },
        {
          debit: 0,
          credit: 1000,
          journalEntry: {
            id: 'je-2',
            entryDate: new Date('2026-03-02'),
            description: 'Loan repayment',
            lines: [
              { accountId: 'cash-1', account: { code: '1000', name: 'Cash', cashFlowCategory: null } },
              { accountId: 'loan-1', account: { code: '2100', name: 'Bank Loan Payable', cashFlowCategory: 'financing' } },
            ],
          },
        },
      ]);

      const result = await service.cashFlow('company-1', new Date('2026-01-01'), new Date('2026-12-31'));

      expect(result.operating.total).toBe('-500');
      expect(result.financing.total).toBe('-1000');
      expect(result.investing.total).toBe('0');
    });

    it('buckets a movement as uncategorized when the counterparty account has no cashFlowCategory set', async () => {
      prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'cash-1' });
      prisma.journalEntryLine.aggregate.mockResolvedValue({ _sum: { debit: 0, credit: 0 } });
      prisma.journalEntryLine.findMany.mockResolvedValue([
        {
          debit: 300,
          credit: 0,
          journalEntry: {
            id: 'je-1',
            entryDate: new Date('2026-03-01'),
            description: 'Uncategorized receipt',
            lines: [
              { accountId: 'cash-1', account: { code: '1000', name: 'Cash', cashFlowCategory: null } },
              { accountId: 'misc-1', account: { code: '9999', name: 'Misc', cashFlowCategory: null } },
            ],
          },
        },
      ]);

      const result = await service.cashFlow('company-1', new Date('2026-01-01'), new Date('2026-12-31'));

      expect(result.uncategorized.total).toBe('300');
      expect(result.operating.total).toBe('0');
    });

    it('computes endingBalance as beginningBalance + netChange', async () => {
      prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'cash-1' });
      prisma.journalEntryLine.aggregate.mockResolvedValue({ _sum: { debit: 5000, credit: 1000 } }); // beginning = 4000
      prisma.journalEntryLine.findMany.mockResolvedValue([
        {
          debit: 800,
          credit: 0,
          journalEntry: {
            id: 'je-1',
            entryDate: new Date('2026-03-01'),
            description: 'Cash from customer',
            lines: [
              { accountId: 'cash-1', account: { code: '1000', name: 'Cash', cashFlowCategory: null } },
              { accountId: 'ar-1', account: { code: '1100', name: 'AR', cashFlowCategory: 'operating' } },
            ],
          },
        },
      ]);

      const result = await service.cashFlow('company-1', new Date('2026-01-01'), new Date('2026-12-31'));

      expect(result.beginningBalance).toBe('4000');
      expect(result.netChange).toBe('800');
      expect(result.endingBalance).toBe('4800');
    });

    it('skips a line entirely when its net cash impact is zero', async () => {
      prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'cash-1' });
      prisma.journalEntryLine.aggregate.mockResolvedValue({ _sum: { debit: 0, credit: 0 } });
      prisma.journalEntryLine.findMany.mockResolvedValue([
        {
          debit: 100,
          credit: 100,
          journalEntry: { id: 'je-1', entryDate: new Date('2026-03-01'), description: 'Wash', lines: [] },
        },
      ]);

      const result = await service.cashFlow('company-1', new Date('2026-01-01'), new Date('2026-12-31'));

      expect(result.operating.lines).toHaveLength(0);
      expect(result.uncategorized.lines).toHaveLength(0);
    });
  });

  describe('zakatBaseEstimate', () => {
    it('computes the core formula: Equity + Long-term Liabilities - Fixed Assets - Long-term Investments', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'capital', code: '3000', name: 'Owner Capital', type: 'equity', normalBalance: 'credit', zakatCategory: null },
        { id: 'loan', code: '2100', name: 'Bank Loan', type: 'liability', normalBalance: 'credit', zakatCategory: 'long_term_liability' },
        { id: 'equip', code: '1500', name: 'Equipment', type: 'asset', normalBalance: 'debit', zakatCategory: 'fixed_asset' },
        { id: 'inv', code: '1600', name: 'Long-term Investment', type: 'asset', normalBalance: 'debit', zakatCategory: 'long_term_investment' },
      ]);
      prisma.journalEntryLine.groupBy.mockResolvedValue([
        { accountId: 'capital', _sum: { debit: 0, credit: 10000 } },
        { accountId: 'loan', _sum: { debit: 0, credit: 3000 } },
        { accountId: 'equip', _sum: { debit: 5000, credit: 0 } },
        { accountId: 'inv', _sum: { debit: 1000, credit: 0 } },
      ]);

      const result = await service.zakatBaseEstimate('company-1', new Date('2026-12-31'));

      // 10000 (equity) + 3000 (LT liability) - 5000 (fixed asset) - 1000 (LT investment) = 7000
      expect(result.totalEquity).toBe('10000');
      expect(result.longTermLiabilities.total).toBe('3000');
      expect(result.fixedAssets.total).toBe('5000');
      expect(result.longTermInvestments.total).toBe('1000');
      expect(result.zakatBaseEstimate).toBe('7000');
    });

    it('never picks between the Hijri and Gregorian rate silently — always returns both', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'capital', code: '3000', name: 'Owner Capital', type: 'equity', normalBalance: 'credit', zakatCategory: null },
      ]);
      prisma.journalEntryLine.groupBy.mockResolvedValue([{ accountId: 'capital', _sum: { debit: 0, credit: 10000 } }]);

      const result = await service.zakatBaseEstimate('company-1', new Date('2026-12-31'));

      expect(result.estimatedZakatDueHijriRate).toBe('250'); // 10000 * 0.025
      expect(result.estimatedZakatDueGregorianRate).toBe('257.69'); // 10000 * 0.025769
    });

    it('floors the zakatable base at zero when the formula produces a negative result (no Zakat owed, not a negative payment)', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'capital', code: '3000', name: 'Owner Capital', type: 'equity', normalBalance: 'credit', zakatCategory: null },
        { id: 'equip', code: '1500', name: 'Equipment', type: 'asset', normalBalance: 'debit', zakatCategory: 'fixed_asset' },
      ]);
      prisma.journalEntryLine.groupBy.mockResolvedValue([
        { accountId: 'capital', _sum: { debit: 0, credit: 1000 } },
        { accountId: 'equip', _sum: { debit: 5000, credit: 0 } },
      ]);

      const result = await service.zakatBaseEstimate('company-1', new Date('2026-12-31'));

      expect(result.zakatBaseEstimate).toBe('-4000'); // the raw base is still shown accurately
      expect(result.estimatedZakatDueHijriRate).toBe('0'); // but nothing is due
      expect(result.estimatedZakatDueGregorianRate).toBe('0');
    });

    it('ignores an account with no zakatCategory tag entirely (treated as already reflected in equity)', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'capital', code: '3000', name: 'Owner Capital', type: 'equity', normalBalance: 'credit', zakatCategory: null },
        { id: 'ar', code: '1100', name: 'Accounts Receivable', type: 'asset', normalBalance: 'debit', zakatCategory: null },
      ]);
      prisma.journalEntryLine.groupBy.mockResolvedValue([
        { accountId: 'capital', _sum: { debit: 0, credit: 10000 } },
        { accountId: 'ar', _sum: { debit: 2000, credit: 0 } },
      ]);

      const result = await service.zakatBaseEstimate('company-1', new Date('2026-12-31'));

      expect(result.zakatBaseEstimate).toBe('10000'); // AR (untagged) has zero effect on the base
    });
  });

  describe('customerAging', () => {
    it('buckets an invoice by days overdue relative to its due date', async () => {
      const asOfDate = new Date('2026-06-30');
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          total: '1000.00',
          amountPaid: '0.00',
          dueDate: new Date('2026-05-01'), // 60 days before asOfDate
          customer: { id: 'cust-1', companyName: 'Acme', customerCode: 'C001' },
          notes: [],
        },
      ]);

      const result = await service.customerAging('company-1', asOfDate);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].days31to60).toBe('1000');
      expect(result.rows[0].current).toBe('0');
    });

    it('places an invoice with no due date in the noDueDate bucket, never guessed as current or overdue', async () => {
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          total: '500.00',
          amountPaid: '0.00',
          dueDate: null,
          customer: { id: 'cust-1', companyName: 'Acme', customerCode: 'C001' },
          notes: [],
        },
      ]);

      const result = await service.customerAging('company-1', new Date('2026-06-30'));

      expect(result.rows[0].noDueDate).toBe('500');
    });

    it('accounts for an issued credit note when computing the remaining (aged) balance', async () => {
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          total: '1000.00',
          amountPaid: '0.00',
          dueDate: new Date('2026-06-01'),
          customer: { id: 'cust-1', companyName: 'Acme', customerCode: 'C001' },
          notes: [{ noteType: 'credit', total: '400.00' }],
        },
      ]);

      const result = await service.customerAging('company-1', new Date('2026-06-30'));

      expect(result.rows[0].total).toBe('600'); // 1000 - 400 credited
    });

    it('skips an invoice whose remaining balance is zero or negative (fully paid/credited)', async () => {
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          total: '1000.00',
          amountPaid: '1000.00',
          dueDate: new Date('2026-05-01'),
          customer: { id: 'cust-1', companyName: 'Acme', customerCode: 'C001' },
          notes: [],
        },
      ]);

      const result = await service.customerAging('company-1', new Date('2026-06-30'));

      expect(result.rows).toHaveLength(0);
    });

    it('groups multiple invoices for the same customer into a single row, and computes a correct grand total', async () => {
      prisma.invoice.findMany.mockResolvedValue([
        { id: 'inv-1', total: '300.00', amountPaid: '0.00', dueDate: new Date('2026-06-25'), customer: { id: 'cust-1', companyName: 'Acme', customerCode: 'C001' }, notes: [] },
        { id: 'inv-2', total: '700.00', amountPaid: '0.00', dueDate: new Date('2026-01-01'), customer: { id: 'cust-1', companyName: 'Acme', customerCode: 'C001' }, notes: [] },
      ]);

      const result = await service.customerAging('company-1', new Date('2026-06-30'));

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].total).toBe('1000');
      expect(result.grandTotal.total).toBe('1000');
    });
  });

  describe('customerStatement', () => {
    it('404s when the customer does not exist in the caller company', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.customerStatement('company-1', 'missing', new Date('2026-01-01'), new Date('2026-12-31')),
      ).rejects.toThrow(NotFoundException);
    });

    it('computes the opening balance from everything dated before fromDate, excluded from the visible lines', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1', companyName: 'Acme', customerCode: 'C001' });
      prisma.invoice.findMany.mockResolvedValue([
        { id: 'inv-old', invoiceNumber: 'INV-OLD', total: '1000.00', issuedAt: new Date('2025-12-01') }, // before fromDate
        { id: 'inv-new', invoiceNumber: 'INV-NEW', total: '500.00', issuedAt: new Date('2026-02-01') }, // within range
      ]);
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.invoiceNote.findMany.mockResolvedValue([]);

      const result = await service.customerStatement('company-1', 'cust-1', new Date('2026-01-01'), new Date('2026-12-31'));

      expect(result.openingBalance).toBe('1000'); // the old invoice, not shown as a line
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].reference).toBe('INV-NEW');
    });

    it('produces a chronologically sorted timeline with a correct running balance across invoice, payment, and note lines', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1', companyName: 'Acme', customerCode: 'C001' });
      prisma.invoice.findMany.mockResolvedValue([
        { id: 'inv-1', invoiceNumber: 'INV-1', total: '1000.00', issuedAt: new Date('2026-01-05') },
      ]);
      prisma.payment.findMany.mockResolvedValue([
        { paymentDate: new Date('2026-01-10'), amount: '400.00', invoice: { invoiceNumber: 'INV-1' } },
      ]);
      prisma.invoiceNote.findMany.mockResolvedValue([
        { noteDate: new Date('2026-01-15'), noteType: 'credit', total: '100.00', noteNumber: 'CN-1', invoice: { invoiceNumber: 'INV-1' } },
      ]);

      const result = await service.customerStatement('company-1', 'cust-1', new Date('2026-01-01'), new Date('2026-12-31'));

      expect(result.lines.map((l) => l.type)).toEqual(['invoice', 'payment', 'credit_note']);
      expect(result.lines[0].runningBalance).toBe('1000'); // +1000
      expect(result.lines[1].runningBalance).toBe('600'); // -400
      expect(result.lines[2].runningBalance).toBe('500'); // -100
      expect(result.closingBalance).toBe('500');
    });

    it('treats a debit note as increasing the balance, in the same direction as an invoice', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1', companyName: 'Acme', customerCode: 'C001' });
      prisma.invoice.findMany.mockResolvedValue([]);
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.invoiceNote.findMany.mockResolvedValue([
        { noteDate: new Date('2026-01-15'), noteType: 'debit', total: '250.00', noteNumber: 'DN-1', invoice: { invoiceNumber: 'INV-1' } },
      ]);

      const result = await service.customerStatement('company-1', 'cust-1', new Date('2026-01-01'), new Date('2026-12-31'));

      expect(result.lines[0].debit).toBe('250');
      expect(result.lines[0].credit).toBe('0');
      expect(result.closingBalance).toBe('250');
    });
  });

  describe('accountLedger', () => {
    it('404s when the account does not exist in the caller company', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(
        service.accountLedger('company-1', 'missing', new Date('2026-01-01'), new Date('2026-12-31')),
      ).rejects.toThrow(NotFoundException);
    });

    it('computes the opening balance from lines dated before fromDate, excluded from the visible lines', async () => {
      prisma.account.findFirst.mockResolvedValue({ id: 'cash', code: '1000', name: 'Cash', normalBalance: 'debit' });
      prisma.journalEntryLine.aggregate.mockResolvedValue({ _sum: { debit: 5000, credit: 1000 } });
      prisma.journalEntryLine.findMany.mockResolvedValue([
        {
          debit: 800,
          credit: 0,
          description: null,
          journalEntry: { entryDate: new Date('2026-03-01'), entryNumber: 'JE-2026-0010', reference: 'INV-1', description: 'Payment received' },
        },
      ]);

      const result = await service.accountLedger('company-1', 'cash', new Date('2026-01-01'), new Date('2026-12-31'));

      expect(result.openingBalance).toBe('4000');
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].runningBalance).toBe('4800');
      expect(result.closingBalance).toBe('4800');
    });

    it('applies the normalBalance sign convention correctly for a credit-normal account (e.g. a liability)', async () => {
      prisma.account.findFirst.mockResolvedValue({ id: 'ap', code: '2000', name: 'Accounts Payable', normalBalance: 'credit' });
      prisma.journalEntryLine.aggregate.mockResolvedValue({ _sum: { debit: 0, credit: 0 } });
      prisma.journalEntryLine.findMany.mockResolvedValue([
        {
          debit: 0,
          credit: 1000,
          description: null,
          journalEntry: { entryDate: new Date('2026-03-01'), entryNumber: 'JE-2026-0011', reference: 'BILL-1', description: 'Bill received' },
        },
        {
          debit: 400,
          credit: 0,
          description: null,
          journalEntry: { entryDate: new Date('2026-03-05'), entryNumber: 'JE-2026-0012', reference: 'BILL-1', description: 'Payment made' },
        },
      ]);

      const result = await service.accountLedger('company-1', 'ap', new Date('2026-01-01'), new Date('2026-12-31'));

      expect(result.lines[0].runningBalance).toBe('1000');
      expect(result.lines[1].runningBalance).toBe('600');
    });

    it('falls back to the parent journal entry description when the line itself has none', async () => {
      prisma.account.findFirst.mockResolvedValue({ id: 'cash', code: '1000', name: 'Cash', normalBalance: 'debit' });
      prisma.journalEntryLine.aggregate.mockResolvedValue({ _sum: { debit: 0, credit: 0 } });
      prisma.journalEntryLine.findMany.mockResolvedValue([
        {
          debit: 100,
          credit: 0,
          description: null,
          journalEntry: { entryDate: new Date('2026-03-01'), entryNumber: 'JE-2026-0013', reference: null, description: 'Entry-level description' },
        },
      ]);

      const result = await service.accountLedger('company-1', 'cash', new Date('2026-01-01'), new Date('2026-12-31'));

      expect(result.lines[0].description).toBe('Entry-level description');
    });

    it('returns an empty ledger (opening === closing) when the account had no activity in the period', async () => {
      prisma.account.findFirst.mockResolvedValue({ id: 'cash', code: '1000', name: 'Cash', normalBalance: 'debit' });
      prisma.journalEntryLine.aggregate.mockResolvedValue({ _sum: { debit: 2000, credit: 0 } });
      prisma.journalEntryLine.findMany.mockResolvedValue([]);

      const result = await service.accountLedger('company-1', 'cash', new Date('2026-01-01'), new Date('2026-12-31'));

      expect(result.lines).toHaveLength(0);
      expect(result.openingBalance).toBe('2000');
      expect(result.closingBalance).toBe('2000');
    });
  });
});
