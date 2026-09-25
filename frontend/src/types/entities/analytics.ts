export interface RevenueTrendPoint {
  month: string; // "YYYY-MM"
  revenue: string;
}

export interface SalesFunnel {
  leads: { total: number; converted: number; won: number };
  opportunities: { total: number; won: number };
  conversionRates: {
    leadToOpportunity: string;
    opportunityToWon: string;
    leadToWon: string;
  };
  wonOpportunityValue: string;
}

export interface TopCustomer {
  customerId: string;
  customerName: string;
  revenue: string;
  invoiceCount: number;
}

export interface EmployeeUtilization {
  employeeId: string;
  employeeName: string;
  totalHours: string;
  billableHours: string;
  utilizationRate: string;
  totalCost: string | null;
}

export interface SalesForecastStageBucket {
  stage: string;
  count: number;
  pipelineValue: string;
  weightedValue: string;
}

export interface SalesForecastMonthBucket {
  month: string; // "YYYY-MM" or "unscheduled"
  pipelineValue: string;
  weightedValue: string;
}

export interface SalesForecastOwnerBucket {
  ownerId: string;
  ownerName: string;
  pipelineValue: string;
  weightedValue: string;
}

export interface SalesForecast {
  totalPipelineValue: string;
  weightedPipelineValue: string;
  openOpportunityCount: number;
  /** null when there are zero closed (won+lost) opportunities ever — never a misleading 0%. */
  historicalWinRate: string | null;
  byStage: SalesForecastStageBucket[];
  byMonth: SalesForecastMonthBucket[];
  byOwner: SalesForecastOwnerBucket[];
}
