import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bankReconciliationsApi } from '../endpoints/bankReconciliations';
import type { CreateBankReconciliationInput, AddStatementLineInput } from '../../types/entities/bankReconciliation';

export function useBankReconciliations(bankAccountId?: string) {
  return useQuery({ queryKey: ['bankReconciliations', 'list', bankAccountId], queryFn: () => bankReconciliationsApi.list(bankAccountId) });
}

export function useBankReconciliation(id: string | undefined) {
  return useQuery({
    queryKey: ['bankReconciliations', 'detail', id],
    queryFn: () => bankReconciliationsApi.get(id!),
    enabled: !!id,
  });
}

export function useUnmatchedLedgerLines(id: string | undefined) {
  return useQuery({
    queryKey: ['bankReconciliations', 'unmatchedLedgerLines', id],
    queryFn: () => bankReconciliationsApi.getUnmatchedLedgerLines(id!),
    enabled: !!id,
  });
}

function invalidateReconciliation(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: ['bankReconciliations', 'detail', id] });
  queryClient.invalidateQueries({ queryKey: ['bankReconciliations', 'unmatchedLedgerLines', id] });
  queryClient.invalidateQueries({ queryKey: ['bankReconciliations', 'list'] });
}

export function useCreateBankReconciliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBankReconciliationInput) => bankReconciliationsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bankReconciliations', 'list'] }),
  });
}

export function useAddStatementLine(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddStatementLineInput) => bankReconciliationsApi.addStatementLine(id, input),
    onSuccess: () => invalidateReconciliation(queryClient, id),
  });
}

export function useRemoveStatementLine(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) => bankReconciliationsApi.removeStatementLine(id, lineId),
    onSuccess: () => invalidateReconciliation(queryClient, id),
  });
}

export function useMatchLine(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, journalEntryLineId }: { lineId: string; journalEntryLineId: string }) =>
      bankReconciliationsApi.matchLine(id, lineId, journalEntryLineId),
    onSuccess: () => invalidateReconciliation(queryClient, id),
  });
}

export function useUnmatchLine(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) => bankReconciliationsApi.unmatchLine(id, lineId),
    onSuccess: () => invalidateReconciliation(queryClient, id),
  });
}

export function useAutoMatch(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => bankReconciliationsApi.autoMatch(id),
    onSuccess: () => invalidateReconciliation(queryClient, id),
  });
}

export function useCompleteReconciliation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => bankReconciliationsApi.complete(id),
    onSuccess: () => invalidateReconciliation(queryClient, id),
  });
}
