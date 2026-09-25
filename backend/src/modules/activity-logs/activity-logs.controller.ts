import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivityLogsService, ActivityLogFilters } from './activity-logs.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Administration / Activity Logs')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/activity-logs')
export class ActivityLogsController {
  constructor(private activityLogsService: ActivityLogsService) {}

  @Get()
  @Permissions('Administration:activity_logs:view')
  findAll(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('permissions') permissions: string[],
    @Query() query: PaginationQueryDto,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('entityId') entityId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const filters: ActivityLogFilters = { entityType, action, userId, entityId, from, to };
    return this.activityLogsService.findAll(companyId, query, filters, permissions ?? []);
  }

  /** Same filters as the list. Capped at EXPORT_MAX_ROWS; the X-Export-Truncated header tells the client when the cap was hit. */
  @Get('export.csv')
  @Permissions('Administration:activity_logs:view')
  async exportCsv(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('permissions') permissions: string[],
    @Res() res: Response,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('entityId') entityId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { csv, truncated } = await this.activityLogsService.exportCsv(
      companyId, { entityType, action, userId, entityId, from, to }, permissions ?? [],
    );
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${stamp}.csv"`);
    res.setHeader('X-Export-Truncated', truncated ? 'true' : 'false');
    res.setHeader('Access-Control-Expose-Headers', 'X-Export-Truncated');
    res.send('\uFEFF' + csv); // BOM: keeps Arabic readable in Excel
  }
}
