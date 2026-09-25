import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRangeQueryDto, RevenueTrendQueryDto, TopCustomersQueryDto } from './dto/analytics-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Analytics / Business Intelligence')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Permissions('Analytics:reports:view')
@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('revenue-trend')
  revenueTrend(@CurrentUser('companyId') companyId: string, @Query() query: RevenueTrendQueryDto) {
    return this.analyticsService.revenueTrend(companyId, query.months);
  }

  @Get('sales-funnel')
  salesFunnel(@CurrentUser('companyId') companyId: string, @Query() query: AnalyticsRangeQueryDto) {
    return this.analyticsService.salesFunnel(companyId, new Date(query.fromDate), new Date(query.toDate));
  }

  @Get('top-customers')
  topCustomers(@CurrentUser('companyId') companyId: string, @Query() query: TopCustomersQueryDto) {
    return this.analyticsService.topCustomers(companyId, new Date(query.fromDate), new Date(query.toDate), query.limit);
  }

  @Get('employee-utilization')
  employeeUtilization(@CurrentUser('companyId') companyId: string, @Query() query: AnalyticsRangeQueryDto) {
    return this.analyticsService.employeeUtilization(companyId, new Date(query.fromDate), new Date(query.toDate));
  }

  @Get('sales-forecast')
  salesForecast(@CurrentUser('companyId') companyId: string) {
    return this.analyticsService.salesForecast(companyId);
  }
}
