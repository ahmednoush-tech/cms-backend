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
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto, UpdateQuotationDto } from './dto/quotation.dto';
import { QuotationFiltersDto } from './dto/quotation-filters.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('CRM / Quotations')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/quotations')
export class QuotationsController {
  constructor(private quotationsService: QuotationsService) {}

  @Post()
  @Permissions('CRM:quotations:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateQuotationDto,
  ) {
    return this.quotationsService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('CRM:quotations:view')
  findAll(@CurrentUser('companyId') companyId: string, @Query() query: QuotationFiltersDto) {
    return this.quotationsService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('CRM:quotations:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotationsService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('CRM:quotations:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuotationDto,
  ) {
    return this.quotationsService.update(companyId, actorUserId, id, dto);
  }

  @Delete(':id')
  @Permissions('CRM:quotations:delete')
  remove(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotationsService.softDelete(companyId, actorUserId, id);
  }

  @Post(':id/send')
  @Permissions('CRM:quotations:send')
  send(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotationsService.send(companyId, actorUserId, id);
  }

  @Post(':id/accept')
  @Permissions('CRM:quotations:accept')
  accept(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotationsService.accept(companyId, actorUserId, id);
  }

  @Post(':id/reject')
  @Permissions('CRM:quotations:reject')
  reject(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotationsService.reject(companyId, actorUserId, id);
  }

  @Post(':id/expire')
  @Permissions('CRM:quotations:edit')
  expire(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotationsService.expire(companyId, actorUserId, id);
  }
}
