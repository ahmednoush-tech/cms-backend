import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBankReconciliationDto } from './dto/create-bank-reconciliation.dto';
import { AddStatementLineDto } from './dto/add-statement-line.dto';
import { MatchStatementLineDto } from './dto/match-statement-line.dto';

const { Decimal } = Prisma;
const MONEY_DP = 2;

@Injectable()
export class BankReconciliationsService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, actorUserId: string, dto: CreateBankReconciliationDto) {
    const account = await this.prisma.account.findFirst({ where: { id: dto.bankAccountId, companyId, deletedAt: null } });
    if (!account) throw new NotFoundException('Account not found.');

    const existing = await this.prisma.bankReconciliation.findUnique({
      where: { companyId_bankAccountId_statementDate: { companyId, bankAccountId: dto.bankAccountId, statementDate: new Date(dto.statementDate) } },
    });
    if (existing) {
      throw new ConflictException('A reconciliation for this account and statement date already exists.');
    }

    return this.prisma.bankReconciliation.create({
      data: {
        companyId,
        bankAccountId: dto.bankAccountId,
        statementDate: new Date(dto.statementDate),
        statementEndingBalance: dto.statementEndingBalance,
        createdBy: actorUserId,
      },
    });
  }

  async findAll(companyId: string, bankAccountId?: string) {
    return this.prisma.bankReconciliation.findMany({
      where: { companyId, ...(bankAccountId ? { bankAccountId } : {}) },
      include: { bankAccount: { select: { id: true, code: true, name: true } } },
      orderBy: { statementDate: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const recon = await this.prisma.bankReconciliation.findFirst({
      where: { id, companyId },
      include: {
        bankAccount: { select: { id: true, code: true, name: true } },
        statementLines: { include: { matchedJournalEntryLine: { include: { journalEntry: true } } }, orderBy: { transactionDate: 'asc' } },
      },
    });
    if (!recon) throw new NotFoundException('Bank reconciliation not found.');
    return recon;
  }

  private assertInProgress(recon: { status: string }) {
    if (recon.status !== 'in_progress') {
      throw new UnprocessableEntityException('This reconciliation has already been completed.');
    }
  }

  async addStatementLine(companyId: string, reconciliationId: string, dto: AddStatementLineDto) {
    const recon = await this.findOne(companyId, reconciliationId);
    this.assertInProgress(recon);

    return this.prisma.bankStatementLine.create({
      data: {
        bankReconciliationId: reconciliationId,
        transactionDate: new Date(dto.transactionDate),
        description: dto.description,
        amount: dto.amount,
      },
    });
  }

  async removeStatementLine(companyId: string, reconciliationId: string, lineId: string) {
    const recon = await this.findOne(companyId, reconciliationId);
    this.assertInProgress(recon);

    const line = recon.statementLines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException('Statement line not found.');

    return this.prisma.bankStatementLine.delete({ where: { id: lineId } });
  }

  async getUnmatchedLedgerLines(companyId: string, reconciliationId: string) {
    const recon = await this.findOne(companyId, reconciliationId);
    return this.prisma.journalEntryLine.findMany({
      where: {
        accountId: recon.bankAccountId,
        bankStatementLine: null,
        journalEntry: { companyId, status: 'posted', entryDate: { lte: recon.statementDate }, deletedAt: null },
      },
      include: { journalEntry: { select: { id: true, entryNumber: true, entryDate: true, reference: true, description: true } } },
      orderBy: { journalEntry: { entryDate: 'asc' } },
    });
  }

  async autoMatch(companyId: string, reconciliationId: string) {
    const recon = await this.findOne(companyId, reconciliationId);
    this.assertInProgress(recon);

    const unmatchedStatementLines = recon.statementLines.filter((l) => !l.matchedJournalEntryLineId);
    const unmatchedLedgerLines = await this.getUnmatchedLedgerLines(companyId, reconciliationId);

    let matchedCount = 0;
    const usedLedgerLineIds = new Set<string>();

    for (const stLine of unmatchedStatementLines) {
      const stAmount = new Decimal(stLine.amount);
      const candidates = unmatchedLedgerLines.filter((led) => {
        if (usedLedgerLineIds.has(led.id)) return false;
        const net = new Decimal(led.debit).sub(led.credit);
        return net.eq(stAmount);
      });

      if (candidates.length === 1) {
        await this.prisma.bankStatementLine.update({
          where: { id: stLine.id },
          data: { matchedJournalEntryLineId: candidates[0].id },
        });
        usedLedgerLineIds.add(candidates[0].id);
        matchedCount++;
      }
    }

    return { matchedCount, remainingUnmatched: unmatchedStatementLines.length - matchedCount };
  }

  async matchLine(companyId: string, reconciliationId: string, statementLineId: string, dto: MatchStatementLineDto) {
    const recon = await this.findOne(companyId, reconciliationId);
    this.assertInProgress(recon);

    const line = recon.statementLines.find((l) => l.id === statementLineId);
    if (!line) throw new NotFoundException('Statement line not found.');
    if (line.matchedJournalEntryLineId) {
      throw new UnprocessableEntityException('This statement line is already matched — unmatch it first.');
    }

    const ledgerLine = await this.prisma.journalEntryLine.findFirst({
      where: {
        id: dto.journalEntryLineId,
        accountId: recon.bankAccountId,
        bankStatementLine: null,
        journalEntry: { companyId, status: 'posted', deletedAt: null },
      },
    });
    if (!ledgerLine) {
      throw new NotFoundException('Ledger line not found, already matched elsewhere, or not on this bank account.');
    }

    return this.prisma.bankStatementLine.update({
      where: { id: statementLineId },
      data: { matchedJournalEntryLineId: ledgerLine.id },
    });
  }

  async unmatchLine(companyId: string, reconciliationId: string, statementLineId: string) {
    const recon = await this.findOne(companyId, reconciliationId);
    this.assertInProgress(recon);

    const line = recon.statementLines.find((l) => l.id === statementLineId);
    if (!line) throw new NotFoundException('Statement line not found.');

    return this.prisma.bankStatementLine.update({
      where: { id: statementLineId },
      data: { matchedJournalEntryLineId: null },
    });
  }

  async complete(companyId: string, reconciliationId: string) {
    const recon = await this.findOne(companyId, reconciliationId);
    this.assertInProgress(recon);

    const ledgerAgg = await this.prisma.journalEntryLine.aggregate({
      where: {
        accountId: recon.bankAccountId,
        journalEntry: { companyId, status: 'posted', entryDate: { lte: recon.statementDate }, deletedAt: null },
      },
      _sum: { debit: true, credit: true },
    });
    const bookBalance = new Decimal(ledgerAgg._sum.debit ?? 0).sub(ledgerAgg._sum.credit ?? 0).toDecimalPlaces(MONEY_DP);

    const unmatchedStatementLines = recon.statementLines.filter((l) => !l.matchedJournalEntryLineId);
    const unmatchedStatementNet = unmatchedStatementLines
      .reduce((sum, l) => sum.add(l.amount), new Decimal(0))
      .toDecimalPlaces(MONEY_DP);

    const unmatchedLedgerLines = await this.getUnmatchedLedgerLines(companyId, reconciliationId);
    const unmatchedLedgerNet = unmatchedLedgerLines
      .reduce((sum, l) => sum.add(new Decimal(l.debit).sub(l.credit)), new Decimal(0))
      .toDecimalPlaces(MONEY_DP);

    const adjustedBankBalance = new Decimal(recon.statementEndingBalance).add(unmatchedLedgerNet).toDecimalPlaces(MONEY_DP);
    const adjustedBookBalance = bookBalance.add(unmatchedStatementNet).toDecimalPlaces(MONEY_DP);
    const variance = adjustedBankBalance.sub(adjustedBookBalance).toDecimalPlaces(MONEY_DP);

    if (!variance.eq(0)) {
      throw new UnprocessableEntityException(
        `Reconciliation does not balance — variance of ${variance.toString()}. Adjusted bank balance: ${adjustedBankBalance.toString()}, adjusted book balance: ${adjustedBookBalance.toString()}. Match or add the missing items before completing.`,
      );
    }

    return this.prisma.bankReconciliation.update({
      where: { id: reconciliationId },
      data: { status: 'completed', bookBalance, completedAt: new Date() },
    });
  }
}
