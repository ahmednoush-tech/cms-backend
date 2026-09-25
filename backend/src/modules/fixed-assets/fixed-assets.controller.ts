import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FixedAssetsService } from './fixed-assets.service';
import { CreateFixedAssetDto } from './dto/create-fixed-asset.dto';
import { UpdateFixedAssetDto } from './dto/update-fixed-asset.dto';
import { DisposeFixedAssetDto } from './dto/dispose-fixed-asset.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Finance / Fixed Assets')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/fixed-assets')
export class FixedAssetsController {
  constructor(private fixedAssetsService: FixedAssetsService) {}

  @Post()
  @Permissions('Finance:fixed_assets:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateFixedAssetDto,
  ) {
    return this.fixedAssetsService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('Finance:fixed_assets:view')
  findAll(@CurrentUser('companyId') companyId: string, @Query() query: PaginationQueryDto & { status?: string }) {
    return this.fixedAssetsService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('Finance:fixed_assets:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.fixedAssetsService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('Finance:fixed_assets:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFixedAssetDto,
  ) {
    return this.fixedAssetsService.update(companyId, id, dto);
  }

  @Post(':id/dispose')
  @Permissions('Finance:fixed_assets:dispose')
  dispose(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisposeFixedAssetDto,
  ) {
    return this.fixedAssetsService.dispose(companyId, actorUserId, id, dto);
  }
}
