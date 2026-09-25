import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PerformanceCriteriaService } from './performance-criteria.service';
import { CreatePerformanceCriterionDto, UpdatePerformanceCriterionDto } from './dto/performance-criterion.dto';

@ApiTags('HR / Performance Criteria')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/performance-criteria')
export class PerformanceCriteriaController {
  constructor(private performanceCriteriaService: PerformanceCriteriaService) {}

  @Get()
  @Permissions('HR:performance_criteria:view')
  findAll(@CurrentUser('companyId') companyId: string) {
    return this.performanceCriteriaService.findAll(companyId);
  }

  @Post()
  @Permissions('HR:performance_criteria:manage')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreatePerformanceCriterionDto) {
    return this.performanceCriteriaService.create(companyId, dto);
  }

  @Patch(':id')
  @Permissions('HR:performance_criteria:manage')
  update(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePerformanceCriterionDto) {
    return this.performanceCriteriaService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('HR:performance_criteria:manage')
  deactivate(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.performanceCriteriaService.deactivate(companyId, id);
  }
}
