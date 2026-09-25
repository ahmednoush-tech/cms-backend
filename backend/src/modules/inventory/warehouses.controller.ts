import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';

@ApiTags('Operations / Warehouses')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/warehouses')
export class WarehousesController {
  constructor(private warehousesService: WarehousesService) {}

  @Get()
  @Permissions('Operations:warehouses:view')
  findAll(@CurrentUser('companyId') companyId: string) {
    return this.warehousesService.findAll(companyId);
  }

  @Get(':id')
  @Permissions('Operations:warehouses:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.warehousesService.findOne(companyId, id);
  }

  @Post()
  @Permissions('Operations:warehouses:manage')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(companyId, dto);
  }

  @Patch(':id')
  @Permissions('Operations:warehouses:manage')
  update(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehousesService.update(companyId, id, dto);
  }
}
