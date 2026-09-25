import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomFieldDefinitionsService } from './custom-field-definitions.service';
import { CreateCustomFieldDefinitionDto } from './dto/create-custom-field-definition.dto';
import { UpdateCustomFieldDefinitionDto } from './dto/update-custom-field-definition.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('CRM / Custom Fields')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/custom-field-definitions')
export class CustomFieldDefinitionsController {
  constructor(private customFieldDefinitionsService: CustomFieldDefinitionsService) {}

  @Post()
  @Permissions('CRM:custom_fields:create')
  create(@CurrentUser('companyId') companyId: string, @CurrentUser('sub') actorUserId: string, @Body() dto: CreateCustomFieldDefinitionDto) {
    return this.customFieldDefinitionsService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('CRM:custom_fields:view')
  findAll(@CurrentUser('companyId') companyId: string, @Query('entityType') entityType: 'lead' | 'opportunity' | 'customer') {
    return this.customFieldDefinitionsService.findAll(companyId, entityType);
  }

  @Get(':id')
  @Permissions('CRM:custom_fields:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.customFieldDefinitionsService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('CRM:custom_fields:edit')
  update(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomFieldDefinitionDto) {
    return this.customFieldDefinitionsService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('CRM:custom_fields:delete')
  deactivate(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.customFieldDefinitionsService.deactivate(companyId, id);
  }
}
