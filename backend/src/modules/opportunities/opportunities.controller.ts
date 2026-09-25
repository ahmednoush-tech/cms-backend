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
import { OpportunitiesService } from './opportunities.service';
import {
  CreateOpportunityDto,
  UpdateOpportunityDto,
  UpdateOpportunityStageDto,
} from './dto/opportunity.dto';
import { OpportunityFiltersDto } from './dto/opportunity-filters.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('CRM / Opportunities')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/opportunities')
export class OpportunitiesController {
  constructor(private opportunitiesService: OpportunitiesService) {}

  @Post()
  @Permissions('CRM:opportunities:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateOpportunityDto,
  ) {
    return this.opportunitiesService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('CRM:opportunities:view')
  findAll(@CurrentUser('companyId') companyId: string, @Query() query: OpportunityFiltersDto) {
    return this.opportunitiesService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('CRM:opportunities:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.opportunitiesService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('CRM:opportunities:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOpportunityDto,
  ) {
    return this.opportunitiesService.update(companyId, actorUserId, id, dto);
  }

  @Patch(':id/stage')
  @Permissions('CRM:opportunities:edit')
  updateStage(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOpportunityStageDto,
  ) {
    return this.opportunitiesService.updateStage(companyId, actorUserId, id, dto);
  }

  @Delete(':id')
  @Permissions('CRM:opportunities:delete')
  remove(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.opportunitiesService.softDelete(companyId, actorUserId, id);
  }
}
