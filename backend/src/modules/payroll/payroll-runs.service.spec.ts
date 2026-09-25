import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PayrollRunsService } from './payroll-runs.service';
import { PeriodLockService } from '../finance/period-lock.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PayrollRunsService', () => {
  let service: PayrollRunsService;
  let prisma: any;
  let periodLock: { assertDateNotLocked: jest.Mock };

  function mockTransaction(prismaMock: any) {
    return jest.fn((arg) => {
      if (typeof arg === 'function') return arg(prismaMock);
      return Promise.all(arg);
    });
  }

  beforeEach(async () => {
    prisma = {
      payrollRun: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      employee: { findMany: jest.fn() },
      payrollSettings: { findUnique: jest.fn() },
      financeSettings: { findUnique: jest.fn() },
      journalEntry: { create: jest.fn(), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn() },
    };
    prisma.$transaction = mockTransaction(prisma);

    periodLock = { assertDateNotLocked: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PayrollRunsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PeriodLockService, useValue: periodLock },
      ],
    }).compile();

    service = moduleRef.get(PayrollRunsService);
  });

  describe('create', () => {
    it('rejects creating a second run for the same month/year', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create('company-1', 'user-1', { month: 6, year: 2026 })).rejects.toThrow(UnprocessableEntityException);
    });

    it('skips an active employee with no basic salary configured, listing them by name', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue(null);
      prisma.employee.findMany.mockResolvedValue([
        { id: 'emp-1', firstName: 'Ahmed', lastName: 'Ali', basicSalary: null, housingAllowance: '0', otherAllowances: '0', gosiEmployeeRate: null, gosiEmployerRate: null },
        { id: 'emp-2', firstName: 'Sara', lastName: 'Nasser', basicSalary: '5000.00', housingAllowance: '1000.00', otherAllowances: '0', gosiEmployeeRate: '9.75', gosiEmployerRate: '11.75' },
      ]);
      prisma.payrollRun.create.mockResolvedValue({ id: 'run-1', payslips: [] });

      const result = await service.create('company-1', 'user-1', { month: 6, year: 2026 });

      expect(result.skippedEmployees).toEqual(['Ahmed Ali (no basic salary configured)']);
    });

    it('rejects when NO active employee has a basic salary configured', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue(null);
      prisma.employee.findMany.mockResolvedValue([
        { id: 'emp-1', firstName: 'Ahmed', lastName: 'Ali', basicSalary: null, housingAllowance: '0', otherAllowances: '0' },
      ]);

      await expect(service.create('company-1', 'user-1', { month: 6, year: 2026 })).rejects.toThrow(UnprocessableEntityException);
    });

    it('calculates GOSI on the contributory wage (basic + housing) only, excluding other allowances', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue(null);
      prisma.employee.findMany.mockResolvedValue([
        { id: 'emp-1', firstName: 'Sara', lastName: 'Nasser', basicSalary: '5000.00', housingAllowance: '1000.00', otherAllowances: '500.00', gosiEmployeeRate: '9.75', gosiEmployerRate: '11.75' },
      ]);
      prisma.payrollRun.create.mockResolvedValue({ id: 'run-1' });

      await service.create('company-1', 'user-1', { month: 6, year: 2026 });

      const payslip = prisma.payrollRun.create.mock.calls[0][0].data.payslips.create[0];
      expect(payslip.gosiEmployeeDeduction.toString()).toBe('585');
      expect(payslip.gosiEmployerContribution.toString()).toBe('705');
      expect(payslip.grossPay.toString()).toBe('6500');
    });

    it('deducts only the EMPLOYEE GOSI portion from net pay — the employer portion never touches it', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue(null);
      prisma.employee.findMany.mockResolvedValue([
        { id: 'emp-1', firstName: 'Sara', lastName: 'Nasser', basicSalary: '5000.00', housingAllowance: '1000.00', otherAllowances: '0', gosiEmployeeRate: '9.75', gosiEmployerRate: '11.75' },
      ]);
      prisma.payrollRun.create.mockResolvedValue({ id: 'run-1' });

      await service.create('company-1', 'user-1', { month: 6, year: 2026 });

      const payslip = prisma.payrollRun.create.mock.calls[0][0].data.payslips.create[0];
      expect(payslip.netPay.toString()).toBe('5415');
    });

    it('treats a missing GOSI rate as zero rather than throwing', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue(null);
      prisma.employee.findMany.mockResolvedValue([
        { id: 'emp-1', firstName: 'John', lastName: 'Doe', basicSalary: '4000.00', housingAllowance: '0', otherAllowances: '0', gosiEmployeeRate: null, gosiEmployerRate: null },
      ]);
      prisma.payrollRun.create.mockResolvedValue({ id: 'run-1' });

      await service.create('company-1', 'user-1', { month: 6, year: 2026 });

      const payslip = prisma.payrollRun.create.mock.calls[0][0].data.payslips.create[0];
      expect(payslip.gosiEmployeeDeduction.toString()).toBe('0');
      expect(payslip.netPay.toString()).toBe('4000');
    });
  });

  describe('process', () => {
    const draftRun = {
      id: 'run-1',
      status: 'draft',
      month: 6,
      year: 2026,
      totalGross: '6000.00',
      totalGosiEmployee: '585.00',
      totalGosiEmployer: '705.00',
      totalNet: '5415.00',
      payslips: [{ employee: {} }],
    };

    it('rejects processing a run that is not draft', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue({ ...draftRun, status: 'processed' });

      await expect(service.process('company-1', 'user-1', 'run-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('requires Salary Expense and Net Pay Payable accounts configured', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue(draftRun);
      prisma.payrollSettings.findUnique.mockResolvedValue({ salaryExpenseAccountId: null });

      await expect(service.process('company-1', 'user-1', 'run-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('requires a GOSI Payable account when the run has any GOSI amount', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue(draftRun);
      prisma.payrollSettings.findUnique.mockResolvedValue({
        salaryExpenseAccountId: 'acc-salary',
        netPayPayableAccountId: 'acc-netpay',
        gosiPayableAccountId: null,
      });

      await expect(service.process('company-1', 'user-1', 'run-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('posts a balanced compound entry: debit Salary + GOSI Employer Expense, credit GOSI Payable + Net Pay Payable', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue(draftRun);
      prisma.payrollSettings.findUnique.mockResolvedValue({
        salaryExpenseAccountId: 'acc-salary',
        gosiEmployerExpenseAccountId: 'acc-gosi-exp',
        gosiPayableAccountId: 'acc-gosi-payable',
        netPayPayableAccountId: 'acc-netpay',
      });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.payrollRun.update.mockResolvedValue({ id: 'run-1', status: 'processed' });

      await service.process('company-1', 'user-1', 'run-1');

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines).toHaveLength(4);
      expect(lines[0]).toMatchObject({ accountId: 'acc-salary' });
      expect(lines[1]).toMatchObject({ accountId: 'acc-gosi-exp' });
      expect(lines[2]).toMatchObject({ accountId: 'acc-gosi-payable' });
      expect(lines[3]).toMatchObject({ accountId: 'acc-netpay' });

      expect(lines[0].debit.toString()).toBe('6000');
      expect(lines[1].debit.toString()).toBe('705');
      expect(lines[2].credit.toString()).toBe('1290');
      expect(lines[3].credit.toString()).toBe('5415');
    });

    it('checks the period lock using the last day of the payroll month', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue(draftRun);
      prisma.payrollSettings.findUnique.mockResolvedValue({
        salaryExpenseAccountId: 'acc-salary',
        gosiEmployerExpenseAccountId: 'acc-gosi-exp',
        gosiPayableAccountId: 'acc-gosi-payable',
        netPayPayableAccountId: 'acc-netpay',
      });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.payrollRun.update.mockResolvedValue({ id: 'run-1', status: 'processed' });

      await service.process('company-1', 'user-1', 'run-1');

      const calledDate: Date = periodLock.assertDateNotLocked.mock.calls[0][1];
      expect(calledDate.getMonth()).toBe(5);
      expect(calledDate.getDate()).toBe(30);
    });
  });

  describe('pay', () => {
    const processedRun = {
      id: 'run-1',
      status: 'processed',
      month: 6,
      year: 2026,
      totalNet: '5415.00',
      payslips: [{ employee: {} }],
    };

    it('rejects paying a run that is not processed', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue({ ...processedRun, status: 'draft' });

      await expect(service.pay('company-1', 'user-1', 'run-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('requires both a Net Pay Payable account and a default Cash account', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue(processedRun);
      prisma.payrollSettings.findUnique.mockResolvedValue({ netPayPayableAccountId: 'acc-netpay' });
      prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: null });

      await expect(service.pay('company-1', 'user-1', 'run-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('posts debit Net Pay Payable, credit Cash for the total net amount', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue(processedRun);
      prisma.payrollSettings.findUnique.mockResolvedValue({ netPayPayableAccountId: 'acc-netpay' });
      prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'acc-cash' });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-2' });
      prisma.payrollRun.update.mockResolvedValue({ id: 'run-1', status: 'paid' });

      await service.pay('company-1', 'user-1', 'run-1');

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines[0].accountId).toBe('acc-netpay');
      expect(lines[0].debit.toString()).toBe('5415');
      expect(lines[1].accountId).toBe('acc-cash');
      expect(lines[1].credit.toString()).toBe('5415');
    });
  });

  describe('findOne', () => {
    it('404s when the run does not exist in the caller company', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue(null);
      await expect(service.findOne('company-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
