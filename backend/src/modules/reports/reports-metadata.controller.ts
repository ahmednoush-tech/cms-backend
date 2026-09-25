import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { REPORTS_REGISTRY } from './reports-registry';

@ApiTags('Analytics / Reports Metadata')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/reports-metadata')
export class ReportsMetadataController {
  /**
   * Strips out the `run` function (not serializable, and not
   * something the frontend has any use for) — only the
   * label/field lists a picker UI needs to render.
   */
  @Get()
  @Permissions('Analytics:custom_reports:view')
  getRegistry() {
    return Object.fromEntries(
      Object.entries(REPORTS_REGISTRY).map(([entityType, config]) => [
        entityType,
        {
          label: config.label,
          groupByFields: config.groupByFields,
          sumFields: config.sumFields,
          filterFields: config.filterFields,
        },
      ]),
    );
  }
}
