import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LeaveBalancesService } from './leave-balances.service';
import { SetLeaveBalanceDto } from './dto/set-leave-balance.dto';

@ApiTags('HR / Leave Balances')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/leave-balances')
export class LeaveBalancesController {
  constructor(private leaveBalancesService: LeaveBalancesService) {}

  @Get('employee/:employeeId/year/:year')
  @Permissions('HR:leave_balances:view')
  listForEmployee(
    @CurrentUser('companyId') companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.leaveBalancesService.listForEmployee(companyId, employeeId, year);
  }

  @Post()
  @Permissions('HR:leave_balances:manage')
  setAllocation(@CurrentUser('companyId') companyId: string, @Body() dto: SetLeaveBalanceDto) {
    return this.leaveBalancesService.setAllocation(companyId, dto);
  }
}
