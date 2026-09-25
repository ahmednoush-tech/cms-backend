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
import { JournalEntriesService } from './journal-entries.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Finance / Journal Entries')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/journal-entries')
export class JournalEntriesController {
  constructor(private journalEntriesService: JournalEntriesService) {}

  @Post()
  @Permissions('Finance:journal_entries:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateJournalEntryDto,
  ) {
    return this.journalEntriesService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('Finance:journal_entries:view')
  findAll(@CurrentUser('companyId') companyId: string, @Query() query: PaginationQueryDto & { status?: string }) {
    return this.journalEntriesService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('Finance:journal_entries:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.journalEntriesService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('Finance:journal_entries:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJournalEntryDto,
  ) {
    return this.journalEntriesService.update(companyId, id, dto);
  }

  @Post(':id/post')
  @Permissions('Finance:journal_entries:post')
  post(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.journalEntriesService.post(companyId, id);
  }

  @Post(':id/void')
  @Permissions('Finance:journal_entries:post')
  void(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.journalEntriesService.void(companyId, id);
  }

  @Delete(':id')
  @Permissions('Finance:journal_entries:delete')
  remove(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.journalEntriesService.softDelete(companyId, id);
  }
}
