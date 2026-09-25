import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdatePayrollSettingsDto } from './dto/update-payroll-settings.dto';

@Injectable()
export class PayrollSettingsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Never 404s — mirrors FinanceSettingsService.get() exactly. A
   * company that hasn't configured payroll accounts yet simply
   * gets a row of nulls; it's PayrollRunsService's job to reject
   * processing a run with a clear message when a required account
   * here is still null.
   */
  async get(companyId: string) {
    const existing = await this.prisma.payrollSettings.findUnique({ where: { companyId } });
    return (
      existing ?? {
        companyId,
        salaryExpenseAccountId: null,
        gosiEmployerExpenseAccountId: null,
        gosiPayableAccountId: null,
        netPayPayableAccountId: null,
        updatedAt: null,
      }
    );
  }

  async update(companyId: string, dto: UpdatePayrollSettingsDto) {
    return this.prisma.payrollSettings.upsert({
      where: { companyId },
      create: { companyId, ...dto },
      update: dto,
    });
  }
}
