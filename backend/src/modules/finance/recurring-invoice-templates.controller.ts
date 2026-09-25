import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RecurringInvoiceTemplatesService } from './recurring-invoice-templates.service';
import { CreateRecurringInvoiceTemplateDto } from './dto/create-recurring-invoice-template.dto';
import { UpdateRecurringInvoiceTemplateDto } from './dto/update-recurring-invoice-template.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Finance / Recurring Invoices')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/recurring-invoice-templates')
export class RecurringInvoiceTemplatesController {
  constructor(private recurringInvoiceTemplatesService: RecurringInvoiceTemplatesService) {}

  @Post()
  @Permissions('Finance:recurring_invoices:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateRecurringInvoiceTemplateDto,
  ) {
    return this.recurringInvoiceTemplatesService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('Finance:recurring_invoices:view')
  findAll(@CurrentUser('companyId') companyId: string) {
    return this.recurringInvoiceTemplatesService.findAll(companyId);
  }

  @Post('generate-due')
  @Permissions('Finance:recurring_invoices:generate')
  generateDue(@CurrentUser('companyId') companyId: string, @CurrentUser('sub') actorUserId: string) {
    return this.recurringInvoiceTemplatesService.generateDue(companyId, actorUserId);
  }

  @Get(':id')
  @Permissions('Finance:recurring_invoices:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.recurringInvoiceTemplatesService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('Finance:recurring_invoices:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecurringInvoiceTemplateDto,
  ) {
    return this.recurringInvoiceTemplatesService.update(companyId, id, dto);
  }

  @Post(':id/pause')
  @Permissions('Finance:recurring_invoices:edit')
  pause(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.recurringInvoiceTemplatesService.pause(companyId, id);
  }

  @Post(':id/resume')
  @Permissions('Finance:recurring_invoices:edit')
  resume(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.recurringInvoiceTemplatesService.resume(companyId, id);
  }

  @Post(':id/cancel')
  @Permissions('Finance:recurring_invoices:edit')
  cancel(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.recurringInvoiceTemplatesService.cancel(companyId, id);
  }
}
