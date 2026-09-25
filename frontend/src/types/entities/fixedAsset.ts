export type FixedAssetStatus = 'active' | 'fully_depreciated' | 'disposed';

export interface DepreciationEntry {
  id: string;
  depreciationRunId: string;
  fixedAssetId: string;
  depreciationAmount: string;
  accumulatedDepreciationAfter: string;
  netBookValueAfter: string;
  createdAt: string;
  fixedAsset?: FixedAsset;
}

export interface FixedAsset {
  id: string;
  companyId: string;
  assetNumber: string;
  name: string;
  category: string | null;
  description: string | null;
  purchaseDate: string;
  purchaseCost: string;
  salvageValue: string;
  usefulLifeMonths: number;
  accumulatedDepreciation: string;
  fixedAssetAccountId: string | null;
  accumulatedDepreciationAccountId: string | null;
  depreciationExpenseAccountId: string | null;
  status: FixedAssetStatus;
  disposedAt: string | null;
  disposalProceeds: string | null;
  disposalJournalEntryId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  depreciationEntries?: DepreciationEntry[];
}

export interface DisposeFixedAssetInput {
  disposalDate: string;
  disposalProceeds?: number;
}

export interface CreateFixedAssetInput {
  name: string;
  category?: string;
  description?: string;
  purchaseDate: string;
  purchaseCost: number;
  salvageValue?: number;
  usefulLifeMonths: number;
  fixedAssetAccountId?: string;
  accumulatedDepreciationAccountId?: string;
  depreciationExpenseAccountId?: string;
}

export interface UpdateFixedAssetInput {
  name?: string;
  category?: string;
  description?: string;
  fixedAssetAccountId?: string;
  accumulatedDepreciationAccountId?: string;
  depreciationExpenseAccountId?: string;
}

export interface FixedAssetFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export interface DepreciationRun {
  id: string;
  companyId: string;
  month: number;
  year: number;
  totalDepreciation: string;
  journalEntryId: string | null;
  createdBy: string | null;
  createdAt: string;
  entries?: DepreciationEntry[];
  skippedAssets?: string[];
}

export interface CreateDepreciationRunInput {
  month: number;
  year: number;
}
