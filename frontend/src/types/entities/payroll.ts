// ============================================================
// Payroll — Phase P1. GOSI rates live on the Employee record
// itself (administration.ts), entered per-employee with no
// default, never assumed here.
// ============================================================

export interface PayrollSettings {
  companyId: string;
  salaryExpenseAccountId: string | null;
  gosiEmployerExpenseAccountId: string | null;
  gosiPayableAccountId: string | null;
  netPayPayableAccountId: string | null;
  updatedAt: string | null;
}

export interface UpdatePayrollSettingsInput {
  salaryExpenseAccountId?: string;
  gosiEmployerExpenseAccountId?: string;
  gosiPayableAccountId?: string;
  netPayPayableAccountId?: string;
}

export type PayrollRunStatus = 'draft' | 'processed' | 'paid' | 'cancelled';

export interface Payslip {
  id: string;
  payrollRunId: string;
  employeeId: string;
  basicSalary: string;
  housingAllowance: string;
  otherAllowances: string;
  grossPay: string;
  gosiEmployeeRate: string;
  gosiEmployerRate: string;
  gosiEmployeeDeduction: string;
  gosiEmployerContribution: string;
  netPay: string;
  createdAt: string;
  employee?: { id: string; firstName: string; lastName: string; employeeNumber: string };
}

export interface PayrollRun {
  id: string;
  companyId: string;
  month: number;
  year: number;
  status: PayrollRunStatus;
  totalGross: string;
  totalGosiEmployee: string;
  totalGosiEmployer: string;
  totalNet: string;
  journalEntryId: string | null;
  paymentJournalEntryId: string | null;
  processedAt: string | null;
  paidAt: string | null;
  createdBy: string | null;
  createdAt: string;
  payslips?: Payslip[];
  /** Only present on the response from create() — names of active employees excluded for missing a basic salary. */
  skippedEmployees?: string[];
}

export interface CreatePayrollRunInput {
  month: number;
  year: number;
}
