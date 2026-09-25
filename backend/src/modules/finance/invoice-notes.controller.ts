import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InvoiceNotesService } from './invoice-notes.service';
import { CreateInvoiceNoteDto } from './dto/create-invoice-note.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Finance / Invoice Notes')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/invoice-notes')
export class InvoiceNotesController {
  constructor(private invoiceNotesService: InvoiceNotesService) {}

  @Post()
  @Permissions('Finance:invoice_notes:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateInvoiceNoteDto,
  ) {
    return this.invoiceNotesService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('Finance:invoice_notes:view')
  findAllForInvoice(@CurrentUser('companyId') companyId: string, @Query('invoiceId', ParseUUIDPipe) invoiceId: string) {
    return this.invoiceNotesService.findAllForInvoice(companyId, invoiceId);
  }

  @Get(':id')
  @Permissions('Finance:invoice_notes:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoiceNotesService.findOne(companyId, id);
  }

  @Post(':id/issue')
  @Permissions('Finance:invoice_notes:issue')
  issue(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invoiceNotesService.issue(companyId, actorUserId, id);
  }

  @Post(':id/cancel')
  @Permissions('Finance:invoice_notes:delete')
  cancel(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoiceNotesService.cancel(companyId, id);
  }
}
