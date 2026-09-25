import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DepreciationRunsService } from './depreciation-runs.service';
import { CreateDepreciationRunDto } from './dto/create-depreciation-run.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Finance / Depreciation Runs')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/depreciation-runs')
export class DepreciationRunsController {
  constructor(private depreciationRunsService: DepreciationRunsService) {}

  @Post()
  @Permissions('Finance:depreciation_runs:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateDepreciationRunDto,
  ) {
    return this.depreciationRunsService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('Finance:depreciation_runs:view')
  findAll(@CurrentUser('companyId') companyId: string) {
    return this.depreciationRunsService.findAll(companyId);
  }

  @Get(':id')
  @Permissions('Finance:depreciation_runs:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.depreciationRunsService.findOne(companyId, id);
  }
}
