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
import { WorkOrdersService } from './work-orders.service';
import {
  AssignWorkOrderDto,
  CreateWorkOrderDto,
  UpdateWorkOrderDto,
  UpdateWorkOrderStatusDto,
} from './dto/work-order.dto';
import { WorkOrderFiltersDto } from './dto/work-order-filters.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Operations / Work Orders')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/work-orders')
export class WorkOrdersController {
  constructor(private workOrdersService: WorkOrdersService) {}

  @Post()
  @Permissions('Operations:work_orders:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateWorkOrderDto,
  ) {
    return this.workOrdersService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('Operations:work_orders:view')
  findAll(@CurrentUser('companyId') companyId: string, @Query() query: WorkOrderFiltersDto) {
    return this.workOrdersService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('Operations:work_orders:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.workOrdersService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('Operations:work_orders:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkOrderDto,
  ) {
    return this.workOrdersService.update(companyId, actorUserId, id, dto);
  }

  @Patch(':id/status')
  @Permissions('Operations:work_orders:edit')
  updateStatus(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkOrderStatusDto,
  ) {
    return this.workOrdersService.updateStatus(companyId, actorUserId, id, dto);
  }

  @Post(':id/assign')
  @Permissions('Operations:work_orders:assign')
  assign(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignWorkOrderDto,
  ) {
    return this.workOrdersService.assign(companyId, actorUserId, id, dto);
  }

  @Delete(':id')
  @Permissions('Operations:work_orders:delete')
  remove(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workOrdersService.softDelete(companyId, actorUserId, id);
  }
}
