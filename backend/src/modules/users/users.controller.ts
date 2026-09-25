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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { GrantPermissionDto } from './dto/grant-permission.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Administration / Users')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @Permissions('Administration:users:create')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateUserDto) {
    return this.usersService.create(companyId, dto);
  }

  @Get()
  @Permissions('Administration:users:view')
  findAll(
    @CurrentUser('companyId') companyId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.usersService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('Administration:users:view')
  findOne(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('Administration:users:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(companyId, id, dto);
  }

  @Patch(':id/password')
  @Permissions('Administration:users:edit')
  setPassword(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPasswordDto,
  ) {
    return this.usersService.setPassword(companyId, id, dto.newPassword);
  }

  @Delete(':id')
  @Permissions('Administration:users:delete')
  remove(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.softDelete(companyId, actorUserId, id);
  }

  @Post(':id/permissions')
  @Permissions('Administration:user_permissions:manage')
  grantPermission(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GrantPermissionDto,
  ) {
    return this.usersService.grantPermission(companyId, id, dto, actorUserId);
  }

  @Delete(':id/permissions/:permissionId')
  @Permissions('Administration:user_permissions:manage')
  revokePermission(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
    @Query('scopeId') scopeId?: string,
  ) {
    return this.usersService.revokePermission(companyId, id, permissionId, actorUserId, scopeId);
  }
}
