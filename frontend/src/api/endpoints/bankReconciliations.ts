import { apiRequest } from '../client';
import type {
  BankReconciliation,
  BankStatementLine,
  UnmatchedLedgerLine,
  CreateBankReconciliationInput,
  AddStatementLineInput,
  AutoMatchResult,
} from '../../types/entities/bankReconciliation';

/** Confirmed 1:1 against backend/src/modules/finance/bank-reconciliations.controller.ts. */
export const bankReconciliationsApi = {
  list: async (bankAccountId?: string): Promise<BankReconciliation[]> => {
    const { data } = await apiRequest<BankReconciliation[]>({ method: 'GET', url: '/bank-reconciliations', params: { bankAccountId } });
    return data;
  },
  get: async (id: string): Promise<BankReconciliation> => {
    const { data } = await apiRequest<BankReconciliation>({ method: 'GET', url: `/bank-reconciliations/${id}` });
    return data;
  },
  create: async (input: CreateBankReconciliationInput): Promise<BankReconciliation> => {
    const { data } = await apiRequest<BankReconciliation>({ method: 'POST', url: '/bank-reconciliations', data: input });
    return data;
  },
  getUnmatchedLedgerLines: async (id: string): Promise<UnmatchedLedgerLine[]> => {
    const { data } = await apiRequest<UnmatchedLedgerLine[]>({ method: 'GET', url: `/bank-reconciliations/${id}/unmatched-ledger-lines` });
    return data;
  },
  addStatementLine: async (id: string, input: AddStatementLineInput): Promise<BankStatementLine> => {
    const { data } = await apiRequest<BankStatementLine>({ method: 'POST', url: `/bank-reconciliations/${id}/statement-lines`, data: input });
    return data;
  },
  removeStatementLine: async (id: string, lineId: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/bank-reconciliations/${id}/statement-lines/${lineId}` });
  },
  matchLine: async (id: string, lineId: string, journalEntryLineId: string): Promise<BankStatementLine> => {
    const { data } = await apiRequest<BankStatementLine>({
      method: 'POST',
      url: `/bank-reconciliations/${id}/statement-lines/${lineId}/match`,
      data: { journalEntryLineId },
    });
    return data;
  },
  unmatchLine: async (id: string, lineId: string): Promise<BankStatementLine> => {
    const { data } = await apiRequest<BankStatementLine>({ method: 'POST', url: `/bank-reconciliations/${id}/statement-lines/${lineId}/unmatch` });
    return data;
  },
  autoMatch: async (id: string): Promise<AutoMatchResult> => {
    const { data } = await apiRequest<AutoMatchResult>({ method: 'POST', url: `/bank-reconciliations/${id}/auto-match` });
    return data;
  },
  complete: async (id: string): Promise<BankReconciliation> => {
    const { data } = await apiRequest<BankReconciliation>({ method: 'POST', url: `/bank-reconciliations/${id}/complete` });
    return data;
  },
};
