export interface TimeEntry {
  id: string;
  companyId: string;
  taskId: string;
  employeeId: string;
  entryDate: string;
  hours: string;
  hourlyRateSnapshot: string | null;
  laborCost: string | null;
  notes: string | null;
  billable: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: { id: string; firstName: string; lastName: string };
  task?: { id: string; title: string };
}

export interface CreateTimeEntryInput {
  taskId: string;
  employeeId: string;
  entryDate: string;
  hours: number;
  notes?: string;
  billable?: boolean;
}

export interface UpdateTimeEntryInput {
  entryDate?: string;
  hours?: number;
  notes?: string;
  billable?: boolean;
}

/**
 * totalCost is `null` (not "0") when no entry in the set has a
 * priced hourly rate — distinct from a genuine zero-cost total,
 * matching TimeEntriesService.summarize() on the backend exactly.
 */
export interface TimeEntrySummary {
  totalHours: string;
  billableHours: string;
  totalCost: string | null;
  entryCount: number;
}
