import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LeaveTypesService } from './leave-types.service';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from './dto/leave-type.dto';

@ApiTags('HR / Leave Types')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/leave-types')
export class LeaveTypesController {
  constructor(private leaveTypesService: LeaveTypesService) {}

  @Get()
  @Permissions('HR:leave_types:view')
  findAll(@CurrentUser('companyId') companyId: string) {
    return this.leaveTypesService.findAll(companyId);
  }

  @Post()
  @Permissions('HR:leave_types:manage')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateLeaveTypeDto) {
    return this.leaveTypesService.create(companyId, dto);
  }

  @Patch(':id')
  @Permissions('HR:leave_types:manage')
  update(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeaveTypeDto) {
    return this.leaveTypesService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('HR:leave_types:manage')
  deactivate(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.leaveTypesService.deactivate(companyId, id);
  }
}
