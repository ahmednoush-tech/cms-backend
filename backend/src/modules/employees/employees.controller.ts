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
import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { EmployeeDocumentsService } from './employee-documents.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuthContext } from '../../common/interfaces/request-context.interface';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

class LinkUserDto {
  @ApiProperty()
  @IsUUID()
  userId: string;
}

@ApiTags('Administration / Employees')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/employees')
export class EmployeesController {
  constructor(
    private employeesService: EmployeesService,
    private employeeDocumentsService: EmployeeDocumentsService,
  ) {}

  @Post()
  @Permissions('Administration:employees:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employeesService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('Administration:employees:view')
  findAll(
    @CurrentUser() user: AuthContext,
    @CurrentUser('companyId') companyId: string,
    @Query() query: PaginationQueryDto,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.employeesService.findAll(companyId, query, user, departmentId);
  }

  /**
   * Static route, deliberately placed BEFORE the `:id` route below
   * — 'expiring-iqamas' must never be captured as a UUID param.
   */
  @Get('expiring-iqamas')
  @Permissions('Administration:employees:view')
  checkExpiringIqamas(@CurrentUser('companyId') companyId: string, @Query('daysThreshold') daysThreshold?: string) {
    return this.employeeDocumentsService.checkExpiringIqamas(companyId, daysThreshold ? Number(daysThreshold) : undefined);
  }

  @Get(':id')
  @Permissions('Administration:employees:view')
  findOne(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employeesService.findOne(companyId, id, user);
  }

  @Patch(':id')
  @Permissions('Administration:employees:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(companyId, actorUserId, id, dto, user);
  }

  @Delete(':id')
  @Permissions('Administration:employees:delete')
  remove(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employeesService.softDelete(companyId, actorUserId, id, user);
  }

  @Post(':id/link-user')
  @Permissions('Administration:employees:edit')
  linkUser(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkUserDto,
  ) {
    return this.employeesService.linkUser(companyId, actorUserId, id, dto.userId, user);
  }
}
