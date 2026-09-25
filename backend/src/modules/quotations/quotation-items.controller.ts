import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { QuotationsService } from './quotations.service';
import { CreateQuotationItemDto, UpdateQuotationItemDto } from './dto/quotation-item.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('CRM / Quotation Items')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/quotations/:quotationId/items')
export class QuotationItemsController {
  constructor(private quotationsService: QuotationsService) {}

  @Post()
  @Permissions('CRM:quotations:edit')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('quotationId', ParseUUIDPipe) quotationId: string,
    @Body() dto: CreateQuotationItemDto,
  ) {
    return this.quotationsService.addItem(companyId, actorUserId, quotationId, dto);
  }

  @Patch(':itemId')
  @Permissions('CRM:quotations:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('quotationId', ParseUUIDPipe) quotationId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateQuotationItemDto,
  ) {
    return this.quotationsService.updateItem(companyId, actorUserId, quotationId, itemId, dto);
  }

  @Delete(':itemId')
  @Permissions('CRM:quotations:edit')
  remove(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('quotationId', ParseUUIDPipe) quotationId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.quotationsService.removeItem(companyId, actorUserId, quotationId, itemId);
  }
}
