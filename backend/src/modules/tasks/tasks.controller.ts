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
import { TasksService } from './tasks.service';
import {
  AssignTaskDto,
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from './dto/task.dto';
import { TaskFiltersDto } from './dto/task-filters.dto';
import { CreateTaskDependencyDto } from './dto/create-task-dependency.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Operations / Tasks')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Post()
  @Permissions('Operations:tasks:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('Operations:tasks:view')
  findAll(@CurrentUser('companyId') companyId: string, @Query() query: TaskFiltersDto) {
    return this.tasksService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('Operations:tasks:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('Operations:tasks:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(companyId, actorUserId, id, dto);
  }

  @Patch(':id/status')
  @Permissions('Operations:tasks:edit')
  updateStatus(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasksService.updateStatus(companyId, actorUserId, id, dto);
  }

  @Post(':id/assign')
  @Permissions('Operations:tasks:assign')
  assign(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTaskDto,
  ) {
    return this.tasksService.assign(companyId, actorUserId, id, dto);
  }

  @Delete(':id')
  @Permissions('Operations:tasks:delete')
  remove(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.softDelete(companyId, actorUserId, id);
  }

  @Post(':id/dependencies')
  @Permissions('Operations:tasks:edit')
  addDependency(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTaskDependencyDto,
  ) {
    return this.tasksService.addDependency(companyId, actorUserId, id, dto);
  }

  @Delete('dependencies/:dependencyId')
  @Permissions('Operations:tasks:edit')
  removeDependency(@CurrentUser('companyId') companyId: string, @Param('dependencyId', ParseUUIDPipe) dependencyId: string) {
    return this.tasksService.removeDependency(companyId, dependencyId);
  }
}
