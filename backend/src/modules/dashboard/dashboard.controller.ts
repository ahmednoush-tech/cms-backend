import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardFiltersDto } from './dto/dashboard-filters.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

/**
 * RBAC model (Phase 2E, approved decision 1):
 *   - /sales requires CRM view access; missing it -> 403 (via @Permissions, standard guard).
 *   - /operations and /workload require Operations view access; missing it -> 403 (via @Permissions).
 *   - /summary has NO @Permissions here — it deliberately does its
 *     own access check inside DashboardService.getSummary(), because
 *     "has CRM OR has Operations" (not AND) is the required rule,
 *     which the standard all-required @Permissions() guard cannot
 *     express. Only "has neither" 403s; a partial-permission caller
 *     gets 200 with only their authorized section(s) included —
 *     never a zero-filled section for data they can't see.
 */
@ApiTags('Dashboard')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('permissions') permissions: string[],
    @Query() filters: DashboardFiltersDto,
  ) {
    return this.dashboardService.getSummary(companyId, permissions, filters);
  }

  @Get('sales')
  @Permissions('CRM:customers:view')
  getSales(@CurrentUser('companyId') companyId: string, @Query() filters: DashboardFiltersDto) {
    return this.dashboardService.getSales(companyId, filters);
  }

  @Get('operations')
  @Permissions('Operations:projects:view')
  getOperations(@CurrentUser('companyId') companyId: string, @Query() filters: DashboardFiltersDto) {
    return this.dashboardService.getOperations(companyId, filters);
  }

  @Get('workload')
  @Permissions('Operations:projects:view')
  getWorkload(@CurrentUser('companyId') companyId: string, @Query() filters: DashboardFiltersDto) {
    return this.dashboardService.getWorkload(companyId, filters);
  }
}
