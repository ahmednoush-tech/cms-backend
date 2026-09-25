import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PayrollRunsService } from './payroll-runs.service';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Payroll / Runs')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/payroll-runs')
export class PayrollRunsController {
  constructor(private payrollRunsService: PayrollRunsService) {}

  @Post()
  @Permissions('Payroll:runs:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreatePayrollRunDto,
  ) {
    return this.payrollRunsService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('Payroll:runs:view')
  findAll(@CurrentUser('companyId') companyId: string) {
    return this.payrollRunsService.findAll(companyId);
  }

  @Get(':id')
  @Permissions('Payroll:runs:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.payrollRunsService.findOne(companyId, id);
  }

  @Post(':id/process')
  @Permissions('Payroll:runs:process')
  process(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payrollRunsService.process(companyId, actorUserId, id);
  }

  @Post(':id/pay')
  @Permissions('Payroll:runs:pay')
  pay(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payrollRunsService.pay(companyId, actorUserId, id);
  }
}
