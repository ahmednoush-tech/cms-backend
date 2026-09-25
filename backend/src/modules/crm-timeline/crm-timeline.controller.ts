import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CrmTimelineService } from './crm-timeline.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('CRM / Timeline')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/crm-timeline')
export class CrmTimelineController {
  constructor(private crmTimelineService: CrmTimelineService) {}

  @Get('customer/:id')
  @Permissions('CRM:customers:view')
  getCustomerTimeline(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.crmTimelineService.getTimeline(companyId, 'customer', id);
  }

  @Get('lead/:id')
  @Permissions('CRM:leads:view')
  getLeadTimeline(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.crmTimelineService.getTimeline(companyId, 'lead', id);
  }
}
