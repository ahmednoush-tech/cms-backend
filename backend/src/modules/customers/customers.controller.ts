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
import { CustomersService } from './customers.service';
import { CustomerDuplicateDetectionService } from './customer-duplicate-detection.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CheckDuplicatesDto } from './dto/check-duplicates.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

// Internal (staff) CRUD for now. Customer-portal read access to
// their OWN customer record is a separate, narrower endpoint set
// planned for when the Customer Portal surface is built — not
// part of this Phase 2C slice, which covers internal CRM only.
@ApiTags('CRM / Customers')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/customers')
export class CustomersController {
  constructor(
    private customersService: CustomersService,
    private customerDuplicateDetectionService: CustomerDuplicateDetectionService,
  ) {}

  @Post()
  @Permissions('CRM:customers:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create(companyId, actorUserId, dto);
  }

  /**
   * A static POST path — no collision risk with @Get(':id') below
   * regardless of order, since NestJS routes by HTTP method AND
   * path together (GET vs POST are never confused). Same
   * permission as create(): checking for duplicates is only ever
   * useful as a step before creating (or editing) a customer.
   */
  @Post('check-duplicates')
  @Permissions('CRM:customers:create')
  checkDuplicates(@CurrentUser('companyId') companyId: string, @Body() dto: CheckDuplicatesDto) {
    return this.customerDuplicateDetectionService.checkForDuplicates(companyId, dto);
  }

  @Get()
  @Permissions('CRM:customers:view')
  findAll(@CurrentUser('companyId') companyId: string, @Query() query: PaginationQueryDto) {
    return this.customersService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('CRM:customers:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('CRM:customers:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(companyId, actorUserId, id, dto);
  }

  @Delete(':id')
  @Permissions('CRM:customers:delete')
  remove(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customersService.softDelete(companyId, actorUserId, id);
  }
}
