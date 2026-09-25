import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PerformanceEvaluationsService } from './performance-evaluations.service';
import { CreatePerformanceEvaluationDto, UpdatePerformanceEvaluationDto } from './dto/performance-evaluation.dto';

@ApiTags('HR / Performance Evaluations')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/performance-evaluations')
export class PerformanceEvaluationsController {
  constructor(private performanceEvaluationsService: PerformanceEvaluationsService) {}

  @Get('employee/:employeeId')
  @Permissions('HR:performance_evaluations:view')
  findAllForEmployee(@CurrentUser('companyId') companyId: string, @Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.performanceEvaluationsService.findAllForEmployee(companyId, employeeId);
  }

  @Get('cycle/:cycleId')
  @Permissions('HR:performance_evaluations:view')
  findAllForCycle(@CurrentUser('companyId') companyId: string, @Param('cycleId', ParseUUIDPipe) cycleId: string) {
    return this.performanceEvaluationsService.findAllForCycle(companyId, cycleId);
  }

  @Get(':id')
  @Permissions('HR:performance_evaluations:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.performanceEvaluationsService.findOne(companyId, id);
  }

  @Post()
  @Permissions('HR:performance_evaluations:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') evaluatorId: string,
    @Body() dto: CreatePerformanceEvaluationDto,
  ) {
    return this.performanceEvaluationsService.create(companyId, evaluatorId, dto);
  }

  @Patch(':id')
  @Permissions('HR:performance_evaluations:create')
  update(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePerformanceEvaluationDto) {
    return this.performanceEvaluationsService.update(companyId, id, dto);
  }

  @Patch(':id/finalize')
  @Permissions('HR:performance_evaluations:finalize')
  finalize(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.performanceEvaluationsService.finalize(companyId, id);
  }
}
