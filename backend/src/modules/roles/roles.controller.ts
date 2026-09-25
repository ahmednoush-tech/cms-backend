import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Administration / RBAC')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/roles')
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Post()
  @Permissions('Administration:roles:manage')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(companyId, dto);
  }

  @Get()
  @Permissions('Administration:roles:manage')
  findAll(@CurrentUser('companyId') companyId: string) {
    return this.rolesService.findAll(companyId);
  }

  @Get(':id')
  @Permissions('Administration:roles:manage')
  findOne(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rolesService.findOne(companyId, id);
  }

  @Post(':id/permissions')
  @Permissions('Administration:roles:manage')
  assignPermissions(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.rolesService.assignPermissions(companyId, id, dto, actorUserId);
  }

  @Post('assign')
  @Permissions('Administration:roles:manage')
  assignToUser(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.rolesService.assignRoleToUser(companyId, dto, actorUserId);
  }

  @Delete('user/:userId/role/:roleId')
  @Permissions('Administration:roles:manage')
  removeFromUser(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Query('scopeId') scopeId?: string,
  ) {
    return this.rolesService.removeRoleFromUser(companyId, userId, roleId, actorUserId, scopeId);
  }
}
