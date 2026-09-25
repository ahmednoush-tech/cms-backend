import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { AssignVehicleDto } from './dto/assign-vehicle.dto';
import { ReturnVehicleDto } from './dto/return-vehicle.dto';
import { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Fleet / Vehicles')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/vehicles')
export class VehiclesController {
  constructor(private vehiclesService: VehiclesService) {}

  @Post()
  @Permissions('Fleet:vehicles:create')
  create(@CurrentUser('companyId') companyId: string, @CurrentUser('sub') actorUserId: string, @Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('Fleet:vehicles:view')
  findAll(@CurrentUser('companyId') companyId: string) {
    return this.vehiclesService.findAll(companyId);
  }

  @Get(':id')
  @Permissions('Fleet:vehicles:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.vehiclesService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('Fleet:vehicles:edit')
  update(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(companyId, id, dto);
  }

  @Post(':id/assign')
  @Permissions('Fleet:vehicles:assign')
  assign(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignVehicleDto,
  ) {
    return this.vehiclesService.assign(companyId, actorUserId, id, dto);
  }

  @Post(':id/return')
  @Permissions('Fleet:vehicles:assign')
  returnVehicle(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReturnVehicleDto) {
    return this.vehiclesService.returnVehicle(companyId, id, dto);
  }

  @Post(':id/maintenance-records')
  @Permissions('Fleet:maintenance:create')
  addMaintenanceRecord(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMaintenanceRecordDto,
  ) {
    return this.vehiclesService.addMaintenanceRecord(companyId, actorUserId, id, dto);
  }
}
