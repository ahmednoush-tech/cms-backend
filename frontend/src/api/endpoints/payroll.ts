import { apiRequest } from '../client';
import type {
  PayrollSettings,
  UpdatePayrollSettingsInput,
  PayrollRun,
  CreatePayrollRunInput,
} from '../../types/entities/payroll';

/** Confirmed 1:1 against backend/src/modules/payroll/payroll-settings.controller.ts. */
export const payrollSettingsApi = {
  get: async (): Promise<PayrollSettings> => {
    const { data } = await apiRequest<PayrollSettings>({ method: 'GET', url: '/payroll-settings' });
    return data;
  },
  update: async (input: UpdatePayrollSettingsInput): Promise<PayrollSettings> => {
    const { data } = await apiRequest<PayrollSettings>({ method: 'PATCH', url: '/payroll-settings', data: input });
    return data;
  },
};

/** Confirmed 1:1 against backend/src/modules/payroll/payroll-runs.controller.ts. */
export const payrollRunsApi = {
  list: async (): Promise<PayrollRun[]> => {
    const { data } = await apiRequest<PayrollRun[]>({ method: 'GET', url: '/payroll-runs' });
    return data;
  },
  get: async (id: string): Promise<PayrollRun> => {
    const { data } = await apiRequest<PayrollRun>({ method: 'GET', url: `/payroll-runs/${id}` });
    return data;
  },
  create: async (input: CreatePayrollRunInput): Promise<PayrollRun> => {
    const { data } = await apiRequest<PayrollRun>({ method: 'POST', url: '/payroll-runs', data: input });
    return data;
  },
  process: async (id: string): Promise<PayrollRun> => {
    const { data } = await apiRequest<PayrollRun>({ method: 'POST', url: `/payroll-runs/${id}/process` });
    return data;
  },
  pay: async (id: string): Promise<PayrollRun> => {
    const { data } = await apiRequest<PayrollRun>({ method: 'POST', url: `/payroll-runs/${id}/pay` });
    return data;
  },
};
