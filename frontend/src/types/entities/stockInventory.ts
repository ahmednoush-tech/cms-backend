export interface Warehouse {
  id: string;
  companyId: string;
  name: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWarehouseInput {
  name: string;
  address?: string;
}

export interface UpdateWarehouseInput {
  name?: string;
  address?: string;
  isActive?: boolean;
}

/**
 * StockItem — NOT the same catalog as the existing (accounting-
 * integrated) InventoryItem in types/entities/finance.ts. This is
 * a separate, simpler multi-warehouse stock-tracking item with no
 * GL/costing integration. See backend schema.prisma's comment on
 * the StockItem model for the full rationale.
 */
export interface StockItem {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  description: string | null;
  unitOfMeasure: string;
  reorderPoint: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStockItemInput {
  sku: string;
  name: string;
  description?: string;
  unitOfMeasure?: string;
  reorderPoint?: number;
}

export interface UpdateStockItemInput {
  name?: string;
  description?: string;
  unitOfMeasure?: string;
  reorderPoint?: number;
  isActive?: boolean;
}

export interface StockLevel {
  id: string;
  companyId: string;
  warehouseId: string;
  itemId: string;
  quantityOnHand: string;
  updatedAt: string;
  item?: StockItem;
  warehouse?: Warehouse;
}

export interface LowStockEntry {
  item: StockItem;
  totalQuantity: number;
}

export type StockMovementType = 'receipt' | 'issue' | 'transfer_out' | 'transfer_in' | 'adjustment';

export interface StockMovement {
  id: string;
  companyId: string;
  itemId: string;
  warehouseId: string;
  movementType: StockMovementType;
  quantity: string;
  relatedMovementId: string | null;
  reason: string | null;
  performedBy: string;
  createdAt: string;
  warehouse?: { id: string; name: string };
  performedByUser?: { id: string; name: string };
}

export interface ReceiptInput {
  itemId: string;
  warehouseId: string;
  quantity: number;
  reason?: string;
}

export interface IssueInput {
  itemId: string;
  warehouseId: string;
  quantity: number;
  reason?: string;
}

export interface TransferInput {
  itemId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  reason?: string;
}

export interface AdjustmentInput {
  itemId: string;
  warehouseId: string;
  newQuantity: number;
  reason?: string;
}
