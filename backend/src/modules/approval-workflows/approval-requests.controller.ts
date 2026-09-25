import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApprovalRequestsService } from './approval-requests.service';
import { CreateApprovalRequestDto, ApprovalActionDto } from './dto/approval-request.dto';

@ApiTags('Administration / Approval Requests')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/approval-requests')
export class ApprovalRequestsController {
  constructor(private approvalRequestsService: ApprovalRequestsService) {}

  @Get()
  @Permissions('Administration:approval_requests:create')
  findAll(@CurrentUser('companyId') companyId: string) {
    return this.approvalRequestsService.findAll(companyId);
  }

  /**
   * MUST be registered before @Get(':id') below — both are single
   * static-vs-dynamic GET segments, and NestJS matches routes in
   * registration order, so ':id' would otherwise swallow this
   * literal path as if "pending-for-me" were an id.
   */
  @Get('pending-for-me')
  @Permissions('Administration:approval_requests:action')
  findPendingForMe(@CurrentUser('companyId') companyId: string, @CurrentUser('sub') userId: string) {
    return this.approvalRequestsService.findPendingForUser(companyId, userId);
  }

  @Get(':id')
  @Permissions('Administration:approval_requests:create')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.approvalRequestsService.findOne(companyId, id);
  }

  @Post()
  @Permissions('Administration:approval_requests:create')
  create(@CurrentUser('companyId') companyId: string, @CurrentUser('sub') userId: string, @Body() dto: CreateApprovalRequestDto) {
    return this.approvalRequestsService.create(companyId, userId, dto);
  }

  @Patch(':id/approve')
  @Permissions('Administration:approval_requests:action')
  approve(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.approvalRequestsService.approve(companyId, id, userId, dto);
  }

  @Patch(':id/reject')
  @Permissions('Administration:approval_requests:action')
  reject(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.approvalRequestsService.reject(companyId, id, userId, dto);
  }

  @Patch(':id/cancel')
  @Permissions('Administration:approval_requests:create')
  cancel(@CurrentUser('companyId') companyId: string, @CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.approvalRequestsService.cancel(companyId, id, userId);
  }
}
