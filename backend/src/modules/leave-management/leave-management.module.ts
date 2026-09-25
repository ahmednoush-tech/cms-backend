import { Module } from '@nestjs/common';
import { LeaveTypesService } from './leave-types.service';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveTypesController } from './leave-types.controller';
import { LeaveBalancesController } from './leave-balances.controller';
import { LeaveRequestsController } from './leave-requests.controller';

@Module({
  controllers: [LeaveTypesController, LeaveBalancesController, LeaveRequestsController],
  providers: [LeaveTypesService, LeaveBalancesService, LeaveRequestsService],
  exports: [LeaveTypesService, LeaveBalancesService, LeaveRequestsService],
})
export class LeaveManagementModule {}
