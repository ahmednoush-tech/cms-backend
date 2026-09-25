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
import { LeadsService } from './leads.service';
import {
  ConvertLeadDto,
  CreateLeadDto,
  UpdateLeadDto,
  UpdateLeadStatusDto,
} from './dto/lead.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('CRM / Leads')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/leads')
export class LeadsController {
  constructor(private leadsService: LeadsService) {}

  @Post()
  @Permissions('CRM:leads:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateLeadDto,
  ) {
    return this.leadsService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('CRM:leads:view')
  findAll(@CurrentUser('companyId') companyId: string, @Query() query: PaginationQueryDto) {
    return this.leadsService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('CRM:leads:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('CRM:leads:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.update(companyId, actorUserId, id, dto);
  }

  @Patch(':id/status')
  @Permissions('CRM:leads:edit')
  updateStatus(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    return this.leadsService.updateStatus(companyId, actorUserId, id, dto);
  }

  @Post(':id/convert')
  @Permissions('CRM:leads:edit', 'CRM:customers:create')
  convert(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertLeadDto,
  ) {
    return this.leadsService.convert(companyId, actorUserId, id, dto);
  }

  @Delete(':id')
  @Permissions('CRM:leads:delete')
  remove(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leadsService.softDelete(companyId, actorUserId, id);
  }
}
