import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApprovalWorkflowsService } from './approval-workflows.service';
import { CreateApprovalWorkflowDto, UpdateApprovalWorkflowDto } from './dto/approval-workflow.dto';

@ApiTags('Administration / Approval Workflows')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/approval-workflows')
export class ApprovalWorkflowsController {
  constructor(private approvalWorkflowsService: ApprovalWorkflowsService) {}

  @Get()
  @Permissions('Administration:approval_workflows:view')
  findAll(@CurrentUser('companyId') companyId: string) {
    return this.approvalWorkflowsService.findAll(companyId);
  }

  @Get(':id')
  @Permissions('Administration:approval_workflows:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.approvalWorkflowsService.findOne(companyId, id);
  }

  @Post()
  @Permissions('Administration:approval_workflows:manage')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateApprovalWorkflowDto) {
    return this.approvalWorkflowsService.create(companyId, dto);
  }

  @Patch(':id')
  @Permissions('Administration:approval_workflows:manage')
  update(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApprovalWorkflowDto) {
    return this.approvalWorkflowsService.update(companyId, id, dto);
  }
}
