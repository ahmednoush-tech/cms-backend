import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FinanceSettingsService } from './finance-settings.service';
import { UpdateFinanceSettingsDto } from './dto/update-finance-settings.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Finance / Settings')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/finance-settings')
export class FinanceSettingsController {
  constructor(private financeSettingsService: FinanceSettingsService) {}

  @Get()
  @Permissions('Finance:settings:manage')
  get(@CurrentUser('companyId') companyId: string) {
    return this.financeSettingsService.get(companyId);
  }

  @Patch()
  @Permissions('Finance:settings:manage')
  update(@CurrentUser('companyId') companyId: string, @Body() dto: UpdateFinanceSettingsDto) {
    return this.financeSettingsService.update(companyId, dto);
  }
}
