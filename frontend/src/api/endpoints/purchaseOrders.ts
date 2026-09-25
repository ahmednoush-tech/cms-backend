import { apiRequest } from '../client';
import type { PaginationMeta } from '../../types/api';
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  CreatePurchaseOrderInput,
  CreatePurchaseOrderItemInput,
  UpdatePurchaseOrderInput,
  RejectPurchaseOrderInput,
  PurchaseOrderFilters,
  ReceivePurchaseOrderInput,
  ReceivePurchaseOrderResult,
} from '../../types/entities/purchaseOrder';
import type { Bill } from '../../types/entities/finance';

/** Confirmed 1:1 against backend/src/modules/finance/purchase-orders.controller.ts and purchase-order-items.controller.ts. */
export const purchaseOrdersApi = {
  list: async (filters: PurchaseOrderFilters): Promise<{ items: PurchaseOrder[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<PurchaseOrder[]>({ method: 'GET', url: '/purchase-orders', params: filters });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  get: async (id: string): Promise<PurchaseOrder> => {
    const { data } = await apiRequest<PurchaseOrder>({ method: 'GET', url: `/purchase-orders/${id}` });
    return data;
  },
  create: async (input: CreatePurchaseOrderInput): Promise<PurchaseOrder> => {
    const { data } = await apiRequest<PurchaseOrder>({ method: 'POST', url: '/purchase-orders', data: input });
    return data;
  },
  update: async (id: string, input: UpdatePurchaseOrderInput): Promise<PurchaseOrder> => {
    const { data } = await apiRequest<PurchaseOrder>({ method: 'PATCH', url: `/purchase-orders/${id}`, data: input });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/purchase-orders/${id}` });
  },
  addItem: async (poId: string, input: CreatePurchaseOrderItemInput): Promise<PurchaseOrderItem> => {
    const { data } = await apiRequest<PurchaseOrderItem>({ method: 'POST', url: `/purchase-orders/${poId}/items`, data: input });
    return data;
  },
  removeItem: async (poId: string, itemId: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/purchase-orders/${poId}/items/${itemId}` });
  },
  submitForApproval: async (id: string): Promise<PurchaseOrder> => {
    const { data } = await apiRequest<PurchaseOrder>({ method: 'POST', url: `/purchase-orders/${id}/submit` });
    return data;
  },
  approve: async (id: string): Promise<PurchaseOrder> => {
    const { data } = await apiRequest<PurchaseOrder>({ method: 'POST', url: `/purchase-orders/${id}/approve` });
    return data;
  },
  reject: async (id: string, input: RejectPurchaseOrderInput): Promise<PurchaseOrder> => {
    const { data } = await apiRequest<PurchaseOrder>({ method: 'POST', url: `/purchase-orders/${id}/reject`, data: input });
    return data;
  },
  send: async (id: string): Promise<PurchaseOrder> => {
    const { data } = await apiRequest<PurchaseOrder>({ method: 'POST', url: `/purchase-orders/${id}/send` });
    return data;
  },
  cancel: async (id: string): Promise<PurchaseOrder> => {
    const { data } = await apiRequest<PurchaseOrder>({ method: 'POST', url: `/purchase-orders/${id}/cancel` });
    return data;
  },
  convertToBill: async (id: string): Promise<Bill> => {
    const { data } = await apiRequest<Bill>({ method: 'POST', url: `/purchase-orders/${id}/convert-to-bill` });
    return data;
  },
  receive: async (id: string, input: ReceivePurchaseOrderInput): Promise<ReceivePurchaseOrderResult> => {
    const { data } = await apiRequest<ReceivePurchaseOrderResult>({ method: 'POST', url: `/purchase-orders/${id}/receive`, data: input });
    return data;
  },
};
