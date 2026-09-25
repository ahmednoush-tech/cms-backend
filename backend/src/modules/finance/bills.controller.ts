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
import { BillsService } from './bills.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Finance / Bills')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/bills')
export class BillsController {
  constructor(private billsService: BillsService) {}

  @Post()
  @Permissions('Finance:bills:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateBillDto,
  ) {
    return this.billsService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('Finance:bills:view')
  findAll(
    @CurrentUser('companyId') companyId: string,
    @Query() query: PaginationQueryDto & { status?: string; vendorId?: string },
  ) {
    return this.billsService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('Finance:bills:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.billsService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('Finance:bills:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBillDto,
  ) {
    return this.billsService.update(companyId, id, dto);
  }

  @Post(':id/receive')
  @Permissions('Finance:bills:receive')
  receive(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billsService.receive(companyId, actorUserId, id);
  }

  @Post(':id/cancel')
  @Permissions('Finance:bills:edit')
  cancel(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.billsService.cancel(companyId, id);
  }

  @Delete(':id')
  @Permissions('Finance:bills:delete')
  remove(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.billsService.softDelete(companyId, id);
  }
}
