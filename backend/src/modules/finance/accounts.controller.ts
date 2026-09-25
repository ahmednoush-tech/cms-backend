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
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Finance / Chart of Accounts')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/accounts')
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @Post()
  @Permissions('Finance:accounts:create')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(companyId, dto);
  }

  @Get()
  @Permissions('Finance:accounts:view')
  findAll(@CurrentUser('companyId') companyId: string, @Query() query: PaginationQueryDto & { type?: string }) {
    return this.accountsService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('Finance:accounts:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.accountsService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('Finance:accounts:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('Finance:accounts:delete')
  remove(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.accountsService.softDelete(companyId, id);
  }
}
