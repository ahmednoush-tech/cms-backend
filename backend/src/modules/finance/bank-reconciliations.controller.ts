import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BankReconciliationsService } from './bank-reconciliations.service';
import { CreateBankReconciliationDto } from './dto/create-bank-reconciliation.dto';
import { AddStatementLineDto } from './dto/add-statement-line.dto';
import { MatchStatementLineDto } from './dto/match-statement-line.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Finance / Bank Reconciliation')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/bank-reconciliations')
export class BankReconciliationsController {
  constructor(private bankReconciliationsService: BankReconciliationsService) {}

  @Post()
  @Permissions('Finance:bank_reconciliation:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateBankReconciliationDto,
  ) {
    return this.bankReconciliationsService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('Finance:bank_reconciliation:view')
  findAll(@CurrentUser('companyId') companyId: string, @Query('bankAccountId') bankAccountId?: string) {
    return this.bankReconciliationsService.findAll(companyId, bankAccountId);
  }

  @Get(':id')
  @Permissions('Finance:bank_reconciliation:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.bankReconciliationsService.findOne(companyId, id);
  }

  @Get(':id/unmatched-ledger-lines')
  @Permissions('Finance:bank_reconciliation:view')
  getUnmatchedLedgerLines(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.bankReconciliationsService.getUnmatchedLedgerLines(companyId, id);
  }

  @Post(':id/statement-lines')
  @Permissions('Finance:bank_reconciliation:create')
  addStatementLine(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddStatementLineDto,
  ) {
    return this.bankReconciliationsService.addStatementLine(companyId, id, dto);
  }

  @Delete(':id/statement-lines/:lineId')
  @Permissions('Finance:bank_reconciliation:create')
  removeStatementLine(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
  ) {
    return this.bankReconciliationsService.removeStatementLine(companyId, id, lineId);
  }

  @Post(':id/statement-lines/:lineId/match')
  @Permissions('Finance:bank_reconciliation:create')
  matchLine(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: MatchStatementLineDto,
  ) {
    return this.bankReconciliationsService.matchLine(companyId, id, lineId, dto);
  }

  @Post(':id/statement-lines/:lineId/unmatch')
  @Permissions('Finance:bank_reconciliation:create')
  unmatchLine(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
  ) {
    return this.bankReconciliationsService.unmatchLine(companyId, id, lineId);
  }

  @Post(':id/auto-match')
  @Permissions('Finance:bank_reconciliation:create')
  autoMatch(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.bankReconciliationsService.autoMatch(companyId, id);
  }

  @Post(':id/complete')
  @Permissions('Finance:bank_reconciliation:complete')
  complete(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.bankReconciliationsService.complete(companyId, id);
  }
}
