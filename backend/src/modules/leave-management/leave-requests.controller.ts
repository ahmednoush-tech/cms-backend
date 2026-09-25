import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto, RejectLeaveRequestDto } from './dto/leave-request.dto';

/**
 * employeeId comes from a route param, not the authenticated
 * user's own linked employee record — staff/HR submit requests ON
 * BEHALF of an employee, the same established pattern as
 * TimeEntriesController (GET by-employee/:employeeId). This system
 * has no employee self-service portal yet.
 */
@ApiTags('HR / Leave Requests')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/leave-requests')
export class LeaveRequestsController {
  constructor(private leaveRequestsService: LeaveRequestsService) {}

  @Get()
  @Permissions('HR:leave_requests:view')
  findAll(@CurrentUser('companyId') companyId: string, @Query('employeeId') employeeId?: string, @Query('status') status?: string) {
    return this.leaveRequestsService.findAll(companyId, { employeeId, status });
  }

  @Get(':id')
  @Permissions('HR:leave_requests:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.leaveRequestsService.findOne(companyId, id);
  }

  @Post('employee/:employeeId')
  @Permissions('HR:leave_requests:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.leaveRequestsService.create(companyId, employeeId, dto);
  }

  @Patch(':id/approve')
  @Permissions('HR:leave_requests:approve')
  approve(@CurrentUser('companyId') companyId: string, @CurrentUser('sub') actorUserId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.leaveRequestsService.approve(companyId, actorUserId, id);
  }

  @Patch(':id/reject')
  @Permissions('HR:leave_requests:approve')
  reject(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectLeaveRequestDto,
  ) {
    return this.leaveRequestsService.reject(companyId, actorUserId, id, dto);
  }

  /**
   * employeeId is a route param, matching create()'s pattern (this
   * system has no employee self-service portal — see this file's
   * top comment). The service still verifies it against the
   * request's own stored employeeId — not as an "is this the
   * logged-in employee" check, but as a data-integrity guard
   * against cancelling the wrong employee's request via a
   * mismatched URL.
   */
  @Patch('employee/:employeeId/:id/cancel')
  @Permissions('HR:leave_requests:create')
  cancel(
    @CurrentUser('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leaveRequestsService.cancel(companyId, id, employeeId);
  }
}
