import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomerContactsService } from './customer-contacts.service';
import { CreateCustomerContactDto, UpdateCustomerContactDto } from './dto/customer-contact.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('CRM / Customer Contacts')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/customers/:customerId/contacts')
export class CustomerContactsController {
  constructor(private contactsService: CustomerContactsService) {}

  @Post()
  @Permissions('CRM:customers:edit')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateCustomerContactDto,
  ) {
    return this.contactsService.create(companyId, actorUserId, customerId, dto);
  }

  @Get()
  @Permissions('CRM:customers:view')
  findAll(
    @CurrentUser('companyId') companyId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.contactsService.findAll(companyId, customerId);
  }

  @Get(':contactId')
  @Permissions('CRM:customers:view')
  findOne(
    @CurrentUser('companyId') companyId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.contactsService.findOne(companyId, customerId, contactId);
  }

  @Patch(':contactId')
  @Permissions('CRM:customers:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateCustomerContactDto,
  ) {
    return this.contactsService.update(companyId, actorUserId, customerId, contactId, dto);
  }

  @Delete(':contactId')
  @Permissions('CRM:customers:edit')
  remove(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.contactsService.remove(companyId, actorUserId, customerId, contactId);
  }
}
