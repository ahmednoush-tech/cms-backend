import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateFinanceSettingsDto } from './dto/update-finance-settings.dto';

@Injectable()
export class FinanceSettingsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Never 404s — a company that hasn't configured Finance yet
   * simply gets a row of nulls. It's InvoicesService/PaymentsService's
   * job to reject issuing/recording with a clear message when a
   * required field here is still null, not this service's.
   */
  async get(companyId: string) {
    const existing = await this.prisma.financeSettings.findUnique({ where: { companyId } });
    return (
      existing ?? {
        companyId,
        defaultReceivableAccountId: null,
        defaultRevenueAccountId: null,
        defaultTaxPayableAccountId: null,
        defaultCashAccountId: null,
        defaultPayableAccountId: null,
        defaultExpenseAccountId: null,
        defaultTaxRecoverableAccountId: null,
        sellerName: null,
        vatRegistrationNumber: null,
        updatedAt: null,
      }
    );
  }

  async update(companyId: string, dto: UpdateFinanceSettingsDto) {
    return this.prisma.financeSettings.upsert({
      where: { companyId },
      create: { companyId, ...dto },
      update: dto,
    });
  }
}
