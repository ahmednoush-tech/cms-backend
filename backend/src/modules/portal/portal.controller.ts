import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PortalService } from './portal.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PortalOnly } from '../../common/decorators/portal-only.decorator';
import { PortalOnlyGuard } from '../../common/guards/portal-only.guard';
import { StatementQueryDto } from './dto/statement-query.dto';

@ApiTags('Customer Portal')
@ApiBearerAuth()
@PortalOnly()
@UseGuards(PortalOnlyGuard)
@Controller('api/v1/portal')
export class PortalController {
  constructor(private portalService: PortalService) {}

  @Get('quotations')
  getQuotations(@CurrentUser('companyId') companyId: string, @CurrentUser('customerId') customerId: string) {
    return this.portalService.getQuotations(companyId, customerId);
  }

  @Get('quotations/:id')
  getQuotationDetail(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('customerId') customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portalService.getQuotationDetail(companyId, customerId, id);
  }

  @Get('invoices')
  getInvoices(@CurrentUser('companyId') companyId: string, @CurrentUser('customerId') customerId: string) {
    return this.portalService.getInvoices(companyId, customerId);
  }

  @Get('invoices/:id')
  getInvoiceDetail(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('customerId') customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portalService.getInvoiceDetail(companyId, customerId, id);
  }

  @Get('projects')
  getProjects(@CurrentUser('companyId') companyId: string, @CurrentUser('customerId') customerId: string) {
    return this.portalService.getProjects(companyId, customerId);
  }

  @Get('statement')
  getStatement(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('customerId') customerId: string,
    @Query() query: StatementQueryDto,
  ) {
    return this.portalService.getStatement(companyId, customerId, new Date(query.fromDate), new Date(query.toDate));
  }
}
