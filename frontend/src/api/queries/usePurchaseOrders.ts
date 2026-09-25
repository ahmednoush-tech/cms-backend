import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { purchaseOrdersApi } from '../endpoints/purchaseOrders';
import type {
  CreatePurchaseOrderInput,
  CreatePurchaseOrderItemInput,
  UpdatePurchaseOrderInput,
  RejectPurchaseOrderInput,
  PurchaseOrderFilters,
  ReceivePurchaseOrderInput,
} from '../../types/entities/purchaseOrder';

export function usePurchaseOrders(filters: PurchaseOrderFilters) {
  return useQuery({ queryKey: ['purchaseOrders', 'list', filters], queryFn: () => purchaseOrdersApi.list(filters) });
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['purchaseOrders', 'detail', id],
    queryFn: () => purchaseOrdersApi.get(id!),
    enabled: !!id,
  });
}

function invalidatePurchaseOrder(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: ['purchaseOrders', 'detail', id] });
  queryClient.invalidateQueries({ queryKey: ['purchaseOrders', 'list'] });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePurchaseOrderInput) => purchaseOrdersApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchaseOrders', 'list'] }),
  });
}

export function useUpdatePurchaseOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePurchaseOrderInput) => purchaseOrdersApi.update(id, input),
    onSuccess: () => invalidatePurchaseOrder(queryClient, id),
  });
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchaseOrders', 'list'] }),
  });
}

export function useAddPurchaseOrderItem(poId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePurchaseOrderItemInput) => purchaseOrdersApi.addItem(poId, input),
    onSuccess: () => invalidatePurchaseOrder(queryClient, poId),
  });
}

export function useRemovePurchaseOrderItem(poId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => purchaseOrdersApi.removeItem(poId, itemId),
    onSuccess: () => invalidatePurchaseOrder(queryClient, poId),
  });
}

export function useSubmitPurchaseOrderForApproval(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => purchaseOrdersApi.submitForApproval(id),
    onSuccess: () => invalidatePurchaseOrder(queryClient, id),
  });
}

export function useApprovePurchaseOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => purchaseOrdersApi.approve(id),
    onSuccess: () => invalidatePurchaseOrder(queryClient, id),
  });
}

export function useRejectPurchaseOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RejectPurchaseOrderInput) => purchaseOrdersApi.reject(id, input),
    onSuccess: () => invalidatePurchaseOrder(queryClient, id),
  });
}

export function useSendPurchaseOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => purchaseOrdersApi.send(id),
    onSuccess: () => invalidatePurchaseOrder(queryClient, id),
  });
}

export function useCancelPurchaseOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => purchaseOrdersApi.cancel(id),
    onSuccess: () => invalidatePurchaseOrder(queryClient, id),
  });
}

export function useConvertPurchaseOrderToBill(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => purchaseOrdersApi.convertToBill(id),
    onSuccess: () => {
      invalidatePurchaseOrder(queryClient, id);
      queryClient.invalidateQueries({ queryKey: ['bills', 'list'] });
    },
  });
}

/** Also invalidates stockLevels — a successful receive may have created real stock movements in the multi-warehouse inventory system via the backend's PurchaseOrderReceiptsService. */
export function useReceivePurchaseOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReceivePurchaseOrderInput) => purchaseOrdersApi.receive(id, input),
    onSuccess: () => {
      invalidatePurchaseOrder(queryClient, id);
      queryClient.invalidateQueries({ queryKey: ['stockLevels'] });
    },
  });
}
