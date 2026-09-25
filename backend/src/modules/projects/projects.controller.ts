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
import { ProjectsService } from './projects.service';
import {
  AssignProjectManagerDto,
  CreateProjectDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
} from './dto/project.dto';
import { ProjectFiltersDto } from './dto/project-filters.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Operations / Projects')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Post()
  @Permissions('Operations:projects:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('Operations:projects:view')
  findAll(@CurrentUser('companyId') companyId: string, @Query() query: ProjectFiltersDto) {
    return this.projectsService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('Operations:projects:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.findOne(companyId, id);
  }

  @Get(':id/gantt')
  @Permissions('Operations:projects:view')
  getGanttData(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.getGanttData(companyId, id);
  }

  @Get(':id/progress')
  @Permissions('Operations:projects:view')
  getProgressAndBudget(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.getProgressAndBudget(companyId, id);
  }

  @Patch(':id')
  @Permissions('Operations:projects:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(companyId, actorUserId, id, dto);
  }

  @Patch(':id/status')
  @Permissions('Operations:projects:edit')
  updateStatus(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectStatusDto,
  ) {
    return this.projectsService.updateStatus(companyId, actorUserId, id, dto);
  }

  @Post(':id/assign-manager')
  @Permissions('Operations:projects:assign')
  assignManager(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignProjectManagerDto,
  ) {
    return this.projectsService.assignManager(companyId, actorUserId, id, dto);
  }

  @Delete(':id')
  @Permissions('Operations:projects:delete')
  remove(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.softDelete(companyId, actorUserId, id);
  }
}
