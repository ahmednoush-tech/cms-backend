import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PayrollSettingsService } from './payroll-settings.service';
import { UpdatePayrollSettingsDto } from './dto/update-payroll-settings.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Payroll / Settings')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/payroll-settings')
export class PayrollSettingsController {
  constructor(private payrollSettingsService: PayrollSettingsService) {}

  @Get()
  @Permissions('Payroll:settings:manage')
  get(@CurrentUser('companyId') companyId: string) {
    return this.payrollSettingsService.get(companyId);
  }

  @Patch()
  @Permissions('Payroll:settings:manage')
  update(@CurrentUser('companyId') companyId: string, @Body() dto: UpdatePayrollSettingsDto) {
    return this.payrollSettingsService.update(companyId, dto);
  }
}
