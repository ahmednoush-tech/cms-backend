export interface Lead {
  id: string;
  companyId: string;
  customerId: string | null;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';
  ownerId: string | null;
  notes: string | null;
  convertedAt: string | null;
  convertedBy: string | null;
  customFields: Record<string, string | number> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadInput {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source?: string;
  notes?: string;
  ownerId?: string;
  customFields?: Record<string, unknown>;
}

export type UpdateLeadInput = Partial<CreateLeadInput>;

export interface UpdateLeadStatusInput {
  status: Lead['status'];
}

/** POST /leads/:id/convert body — matches ConvertLeadDto exactly. */
export interface ConvertLeadInput {
  existingCustomerId?: string;
  customerType?: 'company' | 'individual';
  companyName?: string;
  customerCode?: string;
  createContact?: boolean;
  createOpportunity?: boolean;
  opportunityName?: string;
}
