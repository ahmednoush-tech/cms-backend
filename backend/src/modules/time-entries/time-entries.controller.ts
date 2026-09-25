import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TimeEntriesService } from './time-entries.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Operations / Time Entries')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/time-entries')
export class TimeEntriesController {
  constructor(private timeEntriesService: TimeEntriesService) {}

  @Post()
  @Permissions('Operations:time_entries:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateTimeEntryDto,
  ) {
    return this.timeEntriesService.create(companyId, actorUserId, dto);
  }

  @Get('by-task/:taskId/summary')
  @Permissions('Operations:time_entries:view')
  getTaskSummary(@CurrentUser('companyId') companyId: string, @Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.timeEntriesService.getTaskSummary(companyId, taskId);
  }

  @Get('by-task/:taskId')
  @Permissions('Operations:time_entries:view')
  findAllForTask(@CurrentUser('companyId') companyId: string, @Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.timeEntriesService.findAllForTask(companyId, taskId);
  }

  @Get('by-work-order/:workOrderId/summary')
  @Permissions('Operations:time_entries:view')
  getWorkOrderSummary(@CurrentUser('companyId') companyId: string, @Param('workOrderId', ParseUUIDPipe) workOrderId: string) {
    return this.timeEntriesService.getWorkOrderSummary(companyId, workOrderId);
  }

  @Get('by-project/:projectId/summary')
  @Permissions('Operations:time_entries:view')
  getProjectSummary(@CurrentUser('companyId') companyId: string, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.timeEntriesService.getProjectSummary(companyId, projectId);
  }

  @Get('by-employee/:employeeId')
  @Permissions('Operations:time_entries:view')
  findAllForEmployee(
    @CurrentUser('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.timeEntriesService.findAllForEmployee(companyId, employeeId, new Date(fromDate), new Date(toDate));
  }

  @Get(':id')
  @Permissions('Operations:time_entries:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.timeEntriesService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('Operations:time_entries:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeEntryDto,
  ) {
    return this.timeEntriesService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('Operations:time_entries:delete')
  remove(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.timeEntriesService.softDelete(companyId, id);
  }
}
