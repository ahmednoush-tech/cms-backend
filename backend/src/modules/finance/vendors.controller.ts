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
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Finance / Vendors')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/vendors')
export class VendorsController {
  constructor(private vendorsService: VendorsService) {}

  @Post()
  @Permissions('Finance:vendors:create')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateVendorDto) {
    return this.vendorsService.create(companyId, dto);
  }

  @Get()
  @Permissions('Finance:vendors:view')
  findAll(@CurrentUser('companyId') companyId: string, @Query() query: PaginationQueryDto & { status?: string }) {
    return this.vendorsService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('Finance:vendors:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('Finance:vendors:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.vendorsService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('Finance:vendors:delete')
  remove(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.softDelete(companyId, id);
  }
}
