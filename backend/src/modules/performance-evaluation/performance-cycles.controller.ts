import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PerformanceCyclesService } from './performance-cycles.service';
import { CreatePerformanceCycleDto, UpdatePerformanceCycleDto } from './dto/performance-cycle.dto';

@ApiTags('HR / Performance Cycles')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/performance-cycles')
export class PerformanceCyclesController {
  constructor(private performanceCyclesService: PerformanceCyclesService) {}

  @Get()
  @Permissions('HR:performance_cycles:view')
  findAll(@CurrentUser('companyId') companyId: string) {
    return this.performanceCyclesService.findAll(companyId);
  }

  @Post()
  @Permissions('HR:performance_cycles:manage')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreatePerformanceCycleDto) {
    return this.performanceCyclesService.create(companyId, dto);
  }

  @Patch(':id')
  @Permissions('HR:performance_cycles:manage')
  update(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePerformanceCycleDto) {
    return this.performanceCyclesService.update(companyId, id, dto);
  }
}
