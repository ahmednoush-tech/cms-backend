import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AutomationRulesService } from './automation-rules.service';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('CRM / Automation Rules')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/automation-rules')
export class AutomationRulesController {
  constructor(private automationRulesService: AutomationRulesService) {}

  @Post()
  @Permissions('CRM:automation_rules:create')
  create(@CurrentUser('companyId') companyId: string, @CurrentUser('sub') actorUserId: string, @Body() dto: CreateAutomationRuleDto) {
    return this.automationRulesService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('CRM:automation_rules:view')
  findAll(@CurrentUser('companyId') companyId: string) {
    return this.automationRulesService.findAll(companyId);
  }

  @Get(':id')
  @Permissions('CRM:automation_rules:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.automationRulesService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('CRM:automation_rules:edit')
  update(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAutomationRuleDto) {
    return this.automationRulesService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('CRM:automation_rules:delete')
  remove(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.automationRulesService.remove(companyId, id);
  }
}
