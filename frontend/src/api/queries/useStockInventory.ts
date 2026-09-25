import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { warehousesApi, stockItemsApi, stockLevelsApi, stockMovementsApi } from '../endpoints/stockInventory';
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  CreateStockItemInput,
  UpdateStockItemInput,
  ReceiptInput,
  IssueInput,
  TransferInput,
  AdjustmentInput,
} from '../../types/entities/stockInventory';

export function useWarehouses() {
  return useQuery({ queryKey: ['warehouses'], queryFn: () => warehousesApi.list() });
}

export function useWarehouse(id: string | undefined) {
  return useQuery({ queryKey: ['warehouses', 'detail', id], queryFn: () => warehousesApi.get(id!), enabled: !!id });
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWarehouseInput) => warehousesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['warehouses'] }),
  });
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWarehouseInput }) => warehousesApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['warehouses'] }),
  });
}

export function useStockItems() {
  return useQuery({ queryKey: ['stockItems'], queryFn: () => stockItemsApi.list() });
}

export function useStockItem(id: string | undefined) {
  return useQuery({ queryKey: ['stockItems', 'detail', id], queryFn: () => stockItemsApi.get(id!), enabled: !!id });
}

export function useCreateStockItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStockItemInput) => stockItemsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stockItems'] }),
  });
}

export function useUpdateStockItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateStockItemInput }) => stockItemsApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stockItems'] }),
  });
}

export function useDeactivateStockItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => stockItemsApi.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stockItems'] }),
  });
}

export function useStockLevelsByWarehouse(warehouseId: string | undefined) {
  return useQuery({
    queryKey: ['stockLevels', 'warehouse', warehouseId],
    queryFn: () => stockLevelsApi.byWarehouse(warehouseId!),
    enabled: !!warehouseId,
  });
}

export function useStockLevelsByItem(itemId: string | undefined) {
  return useQuery({
    queryKey: ['stockLevels', 'item', itemId],
    queryFn: () => stockLevelsApi.byItem(itemId!),
    enabled: !!itemId,
  });
}

export function useLowStock() {
  return useQuery({ queryKey: ['stockLevels', 'lowStock'], queryFn: () => stockLevelsApi.lowStock() });
}

export function useStockMovementsForItem(itemId: string | undefined) {
  return useQuery({
    queryKey: ['stockMovements', 'item', itemId],
    queryFn: () => stockMovementsApi.listForItem(itemId!),
    enabled: !!itemId,
  });
}

/** Invalidates everything a successful movement could affect — the item's own stock levels AND every warehouse-scoped view AND the low-stock alert list. */
function invalidateAfterMovement(queryClient: ReturnType<typeof useQueryClient>, itemId: string) {
  queryClient.invalidateQueries({ queryKey: ['stockLevels'] });
  queryClient.invalidateQueries({ queryKey: ['stockMovements', 'item', itemId] });
}

export function useReceiptMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReceiptInput) => stockMovementsApi.receipt(input),
    onSuccess: (_, variables) => invalidateAfterMovement(queryClient, variables.itemId),
  });
}

export function useIssueMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: IssueInput) => stockMovementsApi.issue(input),
    onSuccess: (_, variables) => invalidateAfterMovement(queryClient, variables.itemId),
  });
}

export function useTransferMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TransferInput) => stockMovementsApi.transfer(input),
    onSuccess: (_, variables) => invalidateAfterMovement(queryClient, variables.itemId),
  });
}

export function useAdjustmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdjustmentInput) => stockMovementsApi.adjustment(input),
    onSuccess: (_, variables) => invalidateAfterMovement(queryClient, variables.itemId),
  });
}
