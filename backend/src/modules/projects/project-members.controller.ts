import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProjectMembersService } from './project-members.service';
import { AddProjectMemberDto, UpdateProjectMemberRoleDto } from './dto/project-member.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Operations / Project Members')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/projects/:projectId/members')
export class ProjectMembersController {
  constructor(private projectMembersService: ProjectMembersService) {}

  @Post()
  @Permissions('Operations:project_members:manage')
  add(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: AddProjectMemberDto,
  ) {
    return this.projectMembersService.add(companyId, actorUserId, projectId, dto);
  }

  @Get()
  @Permissions('Operations:project_members:view')
  findAll(
    @CurrentUser('companyId') companyId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projectMembersService.findAll(companyId, projectId);
  }

  @Patch(':employeeId')
  @Permissions('Operations:project_members:manage')
  updateRole(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: UpdateProjectMemberRoleDto,
  ) {
    return this.projectMembersService.updateRole(companyId, actorUserId, projectId, employeeId, dto);
  }

  @Delete(':employeeId')
  @Permissions('Operations:project_members:manage')
  remove(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return this.projectMembersService.remove(companyId, actorUserId, projectId, employeeId);
  }
}
