import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalEntryValidator } from '../../common/services/journal-entry-validator';
import { PeriodLockService } from '../finance/period-lock.service';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';

const { Decimal } = Prisma;
const MONEY_DP = 2;

@Injectable()
export class PayrollRunsService {
  constructor(
    private prisma: PrismaService,
    private periodLock: PeriodLockService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreatePayrollRunDto) {
    const existing = await this.prisma.payrollRun.findUnique({
      where: { companyId_month_year: { companyId, month: dto.month, year: dto.year } },
    });
    if (existing) {
      throw new UnprocessableEntityException(`A payroll run for ${dto.month}/${dto.year} already exists.`);
    }

    const employees = await this.prisma.employee.findMany({ where: { companyId, status: 'active', deletedAt: null } });

    const skipped: string[] = [];
    const payslipData: Array<{
      employeeId: string;
      basicSalary: Prisma.Decimal;
      housingAllowance: Prisma.Decimal;
      otherAllowances: Prisma.Decimal;
      grossPay: Prisma.Decimal;
      gosiEmployeeRate: Prisma.Decimal;
      gosiEmployerRate: Prisma.Decimal;
      gosiEmployeeDeduction: Prisma.Decimal;
      gosiEmployerContribution: Prisma.Decimal;
      netPay: Prisma.Decimal;
    }> = [];

    for (const emp of employees) {
      if (emp.basicSalary === null) {
        skipped.push(`${emp.firstName} ${emp.lastName} (no basic salary configured)`);
        continue;
      }
      const basicSalary = new Decimal(emp.basicSalary);
      const housingAllowance = new Decimal(emp.housingAllowance);
      const otherAllowances = new Decimal(emp.otherAllowances);
      const grossPay = basicSalary.add(housingAllowance).add(otherAllowances);

      const gosiEmployeeRate = new Decimal(emp.gosiEmployeeRate ?? 0);
      const gosiEmployerRate = new Decimal(emp.gosiEmployerRate ?? 0);
      const gosiContributoryWage = basicSalary.add(housingAllowance);
      const gosiEmployeeDeduction = gosiContributoryWage.mul(gosiEmployeeRate).div(100).toDecimalPlaces(MONEY_DP);
      const gosiEmployerContribution = gosiContributoryWage.mul(gosiEmployerRate).div(100).toDecimalPlaces(MONEY_DP);
      const netPay = grossPay.sub(gosiEmployeeDeduction).toDecimalPlaces(MONEY_DP);

      payslipData.push({
        employeeId: emp.id,
        basicSalary,
        housingAllowance,
        otherAllowances,
        grossPay: grossPay.toDecimalPlaces(MONEY_DP),
        gosiEmployeeRate,
        gosiEmployerRate,
        gosiEmployeeDeduction,
        gosiEmployerContribution,
        netPay,
      });
    }

    if (payslipData.length === 0) {
      throw new UnprocessableEntityException(
        'No active employees have a basic salary configured — set one on at least one employee before creating a payroll run.',
      );
    }

    const totals = payslipData.reduce(
      (acc, p) => ({
        totalGross: acc.totalGross.add(p.grossPay),
        totalGosiEmployee: acc.totalGosiEmployee.add(p.gosiEmployeeDeduction),
        totalGosiEmployer: acc.totalGosiEmployer.add(p.gosiEmployerContribution),
        totalNet: acc.totalNet.add(p.netPay),
      }),
      { totalGross: new Decimal(0), totalGosiEmployee: new Decimal(0), totalGosiEmployer: new Decimal(0), totalNet: new Decimal(0) },
    );

    const run = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payrollRun.create({
        data: {
          companyId,
          month: dto.month,
          year: dto.year,
          totalGross: totals.totalGross.toDecimalPlaces(MONEY_DP),
          totalGosiEmployee: totals.totalGosiEmployee.toDecimalPlaces(MONEY_DP),
          totalGosiEmployer: totals.totalGosiEmployer.toDecimalPlaces(MONEY_DP),
          totalNet: totals.totalNet.toDecimalPlaces(MONEY_DP),
          createdBy: actorUserId,
          payslips: { create: payslipData },
        },
        include: { payslips: { include: { employee: true } } },
      });
      return created;
    });

    return { ...run, skippedEmployees: skipped };
  }

  async findAll(companyId: string) {
    return this.prisma.payrollRun.findMany({ where: { companyId }, orderBy: [{ year: 'desc' }, { month: 'desc' }] });
  }

  async findOne(companyId: string, id: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, companyId },
      include: { payslips: { include: { employee: true }, orderBy: { createdAt: 'asc' } } },
    });
    if (!run) throw new NotFoundException('Payroll run not found.');
    return run;
  }

  async process(companyId: string, actorUserId: string, id: string) {
    const run = await this.findOne(companyId, id);
    if (run.status !== 'draft') {
      throw new UnprocessableEntityException(`This action is only available while the run is in 'draft' status (currently '${run.status}').`);
    }

    const settings = await this.prisma.payrollSettings.findUnique({ where: { companyId } });
    if (!settings?.salaryExpenseAccountId || !settings?.netPayPayableAccountId) {
      throw new UnprocessableEntityException(
        'Payroll Settings must have a Salary Expense account and a Net Pay Payable account configured before a run can be processed.',
      );
    }
    const totalGosiEmployer = new Decimal(run.totalGosiEmployer);
    const totalGosiEmployee = new Decimal(run.totalGosiEmployee);
    const totalGosi = totalGosiEmployee.add(totalGosiEmployer);
    if (totalGosi.gt(0) && !settings.gosiPayableAccountId) {
      throw new UnprocessableEntityException('This run has GOSI amounts, but Payroll Settings has no GOSI Payable account configured.');
    }
    if (totalGosiEmployer.gt(0) && !settings.gosiEmployerExpenseAccountId) {
      throw new UnprocessableEntityException('This run has an employer GOSI contribution, but Payroll Settings has no GOSI Employer Expense account configured.');
    }

    const runDate = new Date(run.year, run.month, 0);
    await this.periodLock.assertDateNotLocked(companyId, runDate);

    const lines = [
      { accountId: settings.salaryExpenseAccountId, debit: run.totalGross, credit: 0 },
      ...(totalGosiEmployer.gt(0) ? [{ accountId: settings.gosiEmployerExpenseAccountId!, debit: totalGosiEmployer, credit: 0 }] : []),
      ...(totalGosi.gt(0) ? [{ accountId: settings.gosiPayableAccountId!, debit: 0, credit: totalGosi }] : []),
      { accountId: settings.netPayPayableAccountId, debit: 0, credit: run.totalNet },
    ];
    JournalEntryValidator.assertBalanced(lines);

    return this.prisma.$transaction(async (tx) => {
      const entryNumber = await this.generateJournalEntryNumber(tx, companyId);
      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          entryNumber,
          entryDate: runDate,
          reference: `Payroll ${run.month}/${run.year}`,
          description: `Payroll run for ${run.month}/${run.year}`,
          status: 'posted',
          postedAt: new Date(),
          createdBy: actorUserId,
          lines: { create: lines.map((l, index) => ({ ...l, lineOrder: index })) },
        },
      });

      return tx.payrollRun.update({
        where: { id },
        data: { status: 'processed', journalEntryId: entry.id, processedAt: new Date() },
      });
    });
  }

  async pay(companyId: string, actorUserId: string, id: string) {
    const run = await this.findOne(companyId, id);
    if (run.status !== 'processed') {
      throw new UnprocessableEntityException(`This action is only available while the run is in 'processed' status (currently '${run.status}').`);
    }

    const payrollSettings = await this.prisma.payrollSettings.findUnique({ where: { companyId } });
    const financeSettings = await this.prisma.financeSettings.findUnique({ where: { companyId } });
    if (!payrollSettings?.netPayPayableAccountId || !financeSettings?.defaultCashAccountId) {
      throw new UnprocessableEntityException(
        'A Net Pay Payable account (Payroll Settings) and a default Cash account (Finance Settings) are both required before paying a run.',
      );
    }

    const today = new Date();
    await this.periodLock.assertDateNotLocked(companyId, today);

    const lines = [
      { accountId: payrollSettings.netPayPayableAccountId, debit: run.totalNet, credit: 0 },
      { accountId: financeSettings.defaultCashAccountId, debit: 0, credit: run.totalNet },
    ];
    JournalEntryValidator.assertBalanced(lines);

    return this.prisma.$transaction(async (tx) => {
      const entryNumber = await this.generateJournalEntryNumber(tx, companyId);
      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          entryNumber,
          entryDate: today,
          reference: `Payroll ${run.month}/${run.year}`,
          description: `Payroll payment for ${run.month}/${run.year}`,
          status: 'posted',
          postedAt: new Date(),
          createdBy: actorUserId,
          lines: { create: lines.map((l, index) => ({ ...l, lineOrder: index })) },
        },
      });

      return tx.payrollRun.update({
        where: { id },
        data: { status: 'paid', paymentJournalEntryId: entry.id, paidAt: new Date() },
      });
    });
  }

  private async generateJournalEntryNumber(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `JE-${year}-`;
    const count = await tx.journalEntry.count({ where: { companyId, entryNumber: { startsWith: prefix } } });
    let attempt = count + 1;
    for (let tries = 0; tries < 5; tries++) {
      const candidate = `${prefix}${String(attempt).padStart(4, '0')}`;
      const clash = await tx.journalEntry.findFirst({ where: { companyId, entryNumber: candidate }, select: { id: true } });
      if (!clash) return candidate;
      attempt++;
    }
    throw new UnprocessableEntityException('Could not generate a unique journal entry number, please retry.');
  }
}
