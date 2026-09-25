import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Finance / Invoices')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/invoices')
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Post()
  @Permissions('Finance:invoices:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicesService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('Finance:invoices:view')
  findAll(
    @CurrentUser('companyId') companyId: string,
    @Query() query: PaginationQueryDto & { status?: string; customerId?: string },
  ) {
    return this.invoicesService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('Finance:invoices:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('Finance:invoices:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(companyId, id, dto);
  }

  @Post(':id/issue')
  @Permissions('Finance:invoices:issue')
  issue(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invoicesService.issue(companyId, actorUserId, id);
  }

  @Get(':id/zatca-qr')
  @Permissions('Finance:invoices:view')
  getZatcaQrCode(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.getZatcaQrCode(companyId, id).then((qrCode) => ({ qrCode }));
  }

  @Post(':id/cancel')
  @Permissions('Finance:invoices:edit')
  cancel(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.cancel(companyId, id);
  }

  @Delete(':id')
  @Permissions('Finance:invoices:delete')
  remove(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.softDelete(companyId, id);
  }
}
