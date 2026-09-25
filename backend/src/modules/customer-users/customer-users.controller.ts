import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomerUsersService } from './customer-users.service';
import { CreateCustomerUserDto, LinkExistingUserDto } from './dto/customer-user.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('CRM / Customer Portal Access')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/customers/:customerId/portal-users')
export class CustomerUsersController {
  constructor(private customerUsersService: CustomerUsersService) {}

  @Post()
  @Permissions('CRM:customers:edit')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateCustomerUserDto,
  ) {
    return this.customerUsersService.createPortalUser(companyId, actorUserId, customerId, dto);
  }

  @Post('link-existing')
  @Permissions('CRM:customers:edit')
  linkExisting(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: LinkExistingUserDto,
  ) {
    return this.customerUsersService.linkExistingUser(companyId, actorUserId, customerId, dto);
  }

  @Get()
  @Permissions('CRM:customers:view')
  findAll(
    @CurrentUser('companyId') companyId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.customerUsersService.findAll(companyId, customerId);
  }

  @Delete(':customerUserId')
  @Permissions('CRM:customers:edit')
  revoke(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('customerUserId', ParseUUIDPipe) customerUserId: string,
  ) {
    return this.customerUsersService.revoke(companyId, actorUserId, customerId, customerUserId);
  }
}
