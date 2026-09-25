import { apiRequest } from '../client';
import type {
  Warehouse,
  CreateWarehouseInput,
  UpdateWarehouseInput,
  StockItem,
  CreateStockItemInput,
  UpdateStockItemInput,
  StockLevel,
  LowStockEntry,
  StockMovement,
  ReceiptInput,
  IssueInput,
  TransferInput,
  AdjustmentInput,
} from '../../types/entities/stockInventory';

/** Confirmed 1:1 against backend/src/modules/inventory/*.controller.ts. */
export const warehousesApi = {
  list: async (): Promise<Warehouse[]> => {
    const { data } = await apiRequest<Warehouse[]>({ method: 'GET', url: '/warehouses' });
    return data;
  },
  get: async (id: string): Promise<Warehouse> => {
    const { data } = await apiRequest<Warehouse>({ method: 'GET', url: `/warehouses/${id}` });
    return data;
  },
  create: async (input: CreateWarehouseInput): Promise<Warehouse> => {
    const { data } = await apiRequest<Warehouse>({ method: 'POST', url: '/warehouses', data: input });
    return data;
  },
  update: async (id: string, input: UpdateWarehouseInput): Promise<Warehouse> => {
    const { data } = await apiRequest<Warehouse>({ method: 'PATCH', url: `/warehouses/${id}`, data: input });
    return data;
  },
};

export const stockItemsApi = {
  list: async (): Promise<StockItem[]> => {
    const { data } = await apiRequest<StockItem[]>({ method: 'GET', url: '/inventory-items' });
    return data;
  },
  get: async (id: string): Promise<StockItem> => {
    const { data } = await apiRequest<StockItem>({ method: 'GET', url: `/inventory-items/${id}` });
    return data;
  },
  create: async (input: CreateStockItemInput): Promise<StockItem> => {
    const { data } = await apiRequest<StockItem>({ method: 'POST', url: '/inventory-items', data: input });
    return data;
  },
  update: async (id: string, input: UpdateStockItemInput): Promise<StockItem> => {
    const { data } = await apiRequest<StockItem>({ method: 'PATCH', url: `/inventory-items/${id}`, data: input });
    return data;
  },
  deactivate: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/inventory-items/${id}` });
  },
};

export const stockLevelsApi = {
  byWarehouse: async (warehouseId: string): Promise<StockLevel[]> => {
    const { data } = await apiRequest<StockLevel[]>({ method: 'GET', url: `/inventory-stock/warehouse/${warehouseId}` });
    return data;
  },
  byItem: async (itemId: string): Promise<StockLevel[]> => {
    const { data } = await apiRequest<StockLevel[]>({ method: 'GET', url: `/inventory-stock/item/${itemId}` });
    return data;
  },
  lowStock: async (): Promise<LowStockEntry[]> => {
    const { data } = await apiRequest<LowStockEntry[]>({ method: 'GET', url: '/inventory-stock/low-stock' });
    return data;
  },
};

export const stockMovementsApi = {
  listForItem: async (itemId: string): Promise<StockMovement[]> => {
    const { data } = await apiRequest<StockMovement[]>({ method: 'GET', url: `/inventory-movements/item/${itemId}` });
    return data;
  },
  receipt: async (input: ReceiptInput): Promise<StockMovement> => {
    const { data } = await apiRequest<StockMovement>({ method: 'POST', url: '/inventory-movements/receipt', data: input });
    return data;
  },
  issue: async (input: IssueInput): Promise<StockMovement> => {
    const { data } = await apiRequest<StockMovement>({ method: 'POST', url: '/inventory-movements/issue', data: input });
    return data;
  },
  transfer: async (input: TransferInput): Promise<{ outMovement: StockMovement; inMovement: StockMovement }> => {
    const { data } = await apiRequest<{ outMovement: StockMovement; inMovement: StockMovement }>({
      method: 'POST',
      url: '/inventory-movements/transfer',
      data: input,
    });
    return data;
  },
  adjustment: async (input: AdjustmentInput): Promise<StockMovement> => {
    const { data } = await apiRequest<StockMovement>({ method: 'POST', url: '/inventory-movements/adjustment', data: input });
    return data;
  },
};
