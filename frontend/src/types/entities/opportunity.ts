export interface Opportunity {
  id: string;
  companyId: string;
  customerId: string;
  leadId: string | null;
  name: string;
  description: string | null;
  /** Prisma Decimal -> serialized as a string, confirmed this session. */
  value: string | null;
  currency: string | null;
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'won' | 'lost';
  probability: number | null;
  expectedCloseDate: string | null;
  ownerId: string | null;
  customFields: Record<string, string | number> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOpportunityInput {
  customerId: string;
  name: string;
  description?: string;
  value?: number;
  currency?: string;
  probability?: number;
  expectedCloseDate?: string;
  ownerId?: string;
  customFields?: Record<string, unknown>;
}

export type UpdateOpportunityInput = Partial<Omit<CreateOpportunityInput, 'customerId'>>;

export interface UpdateOpportunityStageInput {
  stage: Opportunity['stage'];
}

export interface OpportunityFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  customerId?: string;
  stage?: string;
}
