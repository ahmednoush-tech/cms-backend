export type PurchaseOrderStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'sent' | 'closed' | 'cancelled';

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  tax: string;
  total: string;
  inventoryItemId: string | null;
  /** Link to the NEW multi-warehouse stock catalog — separate from inventoryItemId (the OLD, accounting-integrated catalog). A line may reference neither, either, or both. */
  stockItemId: string | null;
  /** Cached running total of how much has been received so far — updated by the receive endpoint, never edited directly. */
  receivedQuantity: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  companyId: string;
  vendorId: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  expectedDeliveryDate: string | null;
  notes: string | null;
  rejectionReason: string | null;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  billId: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  items?: PurchaseOrderItem[];
  vendor?: { id: string; name: string };
  approvedByUser?: { id: string; email: string } | null;
}

export interface CreatePurchaseOrderItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
  inventoryItemId?: string;
  stockItemId?: string;
}

export interface CreatePurchaseOrderInput {
  vendorId: string;
  expectedDeliveryDate?: string;
  notes?: string;
  items?: CreatePurchaseOrderItemInput[];
}

export interface UpdatePurchaseOrderInput {
  expectedDeliveryDate?: string;
  notes?: string;
}

export interface RejectPurchaseOrderInput {
  rejectionReason: string;
}

export interface PurchaseOrderFilters {
  page?: number;
  pageSize?: number;
  status?: string;
  vendorId?: string;
}

export interface ReceiveLineInput {
  purchaseOrderItemId: string;
  quantity: number;
}

export interface ReceivePurchaseOrderInput {
  warehouseId: string;
  lines: ReceiveLineInput[];
}

export interface ReceivePurchaseOrderResult {
  purchaseOrderId: string;
  results: Array<{ purchaseOrderItemId: string; receivedNow: number; movementCreated: boolean }>;
}
