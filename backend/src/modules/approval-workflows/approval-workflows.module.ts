import { Module } from '@nestjs/common';
import { ApprovalWorkflowsService } from './approval-workflows.service';
import { ApprovalRequestsService } from './approval-requests.service';
import { ApprovalWorkflowsController } from './approval-workflows.controller';
import { ApprovalRequestsController } from './approval-requests.controller';

@Module({
  controllers: [ApprovalWorkflowsController, ApprovalRequestsController],
  providers: [ApprovalWorkflowsService, ApprovalRequestsService],
  exports: [ApprovalWorkflowsService, ApprovalRequestsService],
})
export class ApprovalWorkflowsModule {}
