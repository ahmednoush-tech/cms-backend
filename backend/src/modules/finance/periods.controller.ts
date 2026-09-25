import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PeriodsService } from './periods.service';
import { CreatePeriodDto } from './dto/create-period.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Finance / Accounting Periods')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/accounting-periods')
export class PeriodsController {
  constructor(private periodsService: PeriodsService) {}

  @Post()
  @Permissions('Finance:periods:manage')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreatePeriodDto) {
    return this.periodsService.create(companyId, dto);
  }

  @Get()
  @Permissions('Finance:periods:view')
  findAll(@CurrentUser('companyId') companyId: string) {
    return this.periodsService.findAll(companyId);
  }

  @Get(':id')
  @Permissions('Finance:periods:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.periodsService.findOne(companyId, id);
  }

  @Post(':id/lock')
  @Permissions('Finance:periods:manage')
  lock(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.periodsService.lock(companyId, actorUserId, id);
  }

  @Post(':id/unlock')
  @Permissions('Finance:periods:manage')
  unlock(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.periodsService.unlock(companyId, id);
  }
}
