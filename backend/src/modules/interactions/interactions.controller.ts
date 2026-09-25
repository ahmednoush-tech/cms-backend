import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InteractionsService } from './interactions.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { UpdateInteractionDto } from './dto/update-interaction.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('CRM / Interactions')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/interactions')
export class InteractionsController {
  constructor(private interactionsService: InteractionsService) {}

  @Post()
  @Permissions('CRM:interactions:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateInteractionDto,
  ) {
    return this.interactionsService.create(companyId, actorUserId, dto);
  }

  @Get('by-customer/:customerId')
  @Permissions('CRM:interactions:view')
  findAllForCustomer(@CurrentUser('companyId') companyId: string, @Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.interactionsService.findAllForCustomer(companyId, customerId);
  }

  @Get('by-lead/:leadId')
  @Permissions('CRM:interactions:view')
  findAllForLead(@CurrentUser('companyId') companyId: string, @Param('leadId', ParseUUIDPipe) leadId: string) {
    return this.interactionsService.findAllForLead(companyId, leadId);
  }

  @Get('by-opportunity/:opportunityId')
  @Permissions('CRM:interactions:view')
  findAllForOpportunity(@CurrentUser('companyId') companyId: string, @Param('opportunityId', ParseUUIDPipe) opportunityId: string) {
    return this.interactionsService.findAllForOpportunity(companyId, opportunityId);
  }

  @Get(':id')
  @Permissions('CRM:interactions:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.interactionsService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('CRM:interactions:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInteractionDto,
  ) {
    return this.interactionsService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('CRM:interactions:delete')
  remove(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.interactionsService.softDelete(companyId, id);
  }
}
