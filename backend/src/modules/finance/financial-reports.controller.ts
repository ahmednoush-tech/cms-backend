import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FinancialReportsService } from './financial-reports.service';
import { AsOfDateQueryDto, DateRangeQueryDto } from './dto/report-query.dto';
import { CustomerStatementQueryDto } from './dto/customer-statement-query.dto';
import { AccountLedgerQueryDto } from './dto/account-ledger-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Finance / Reports')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/finance-reports')
export class FinancialReportsController {
  constructor(private reportsService: FinancialReportsService) {}

  @Get('trial-balance')
  @Permissions('Finance:reports:view')
  trialBalance(@CurrentUser('companyId') companyId: string, @Query() query: AsOfDateQueryDto) {
    return this.reportsService.trialBalance(companyId, new Date(query.asOfDate));
  }

  @Get('income-statement')
  @Permissions('Finance:reports:view')
  incomeStatement(@CurrentUser('companyId') companyId: string, @Query() query: DateRangeQueryDto) {
    return this.reportsService.incomeStatement(companyId, new Date(query.fromDate), new Date(query.toDate));
  }

  @Get('balance-sheet')
  @Permissions('Finance:reports:view')
  balanceSheet(@CurrentUser('companyId') companyId: string, @Query() query: AsOfDateQueryDto) {
    return this.reportsService.balanceSheet(companyId, new Date(query.asOfDate));
  }

  @Get('cash-flow')
  @Permissions('Finance:reports:view')
  cashFlow(@CurrentUser('companyId') companyId: string, @Query() query: DateRangeQueryDto) {
    return this.reportsService.cashFlow(companyId, new Date(query.fromDate), new Date(query.toDate));
  }

  @Get('zakat-base-estimate')
  @Permissions('Finance:reports:view')
  zakatBaseEstimate(@CurrentUser('companyId') companyId: string, @Query() query: AsOfDateQueryDto) {
    return this.reportsService.zakatBaseEstimate(companyId, new Date(query.asOfDate));
  }

  @Get('customer-aging')
  @Permissions('Finance:reports:view')
  customerAging(@CurrentUser('companyId') companyId: string, @Query() query: AsOfDateQueryDto) {
    return this.reportsService.customerAging(companyId, new Date(query.asOfDate));
  }

  @Get('customer-statement')
  @Permissions('Finance:reports:view')
  customerStatement(@CurrentUser('companyId') companyId: string, @Query() query: CustomerStatementQueryDto) {
    return this.reportsService.customerStatement(companyId, query.customerId, new Date(query.fromDate), new Date(query.toDate));
  }

  @Get('account-ledger')
  @Permissions('Finance:reports:view')
  accountLedger(@CurrentUser('companyId') companyId: string, @Query() query: AccountLedgerQueryDto) {
    return this.reportsService.accountLedger(companyId, query.accountId, new Date(query.fromDate), new Date(query.toDate));
  }
}
