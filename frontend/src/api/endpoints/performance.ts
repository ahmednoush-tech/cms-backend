import { apiRequest } from '../client';
import type {
  PerformanceCycle,
  CreatePerformanceCycleInput,
  UpdatePerformanceCycleInput,
  PerformanceCriterion,
  CreatePerformanceCriterionInput,
  UpdatePerformanceCriterionInput,
  PerformanceEvaluation,
  CreatePerformanceEvaluationInput,
  UpdatePerformanceEvaluationInput,
} from '../../types/entities/performance';

/** Confirmed 1:1 against backend/src/modules/performance-evaluation/*.controller.ts. */
export const performanceCyclesApi = {
  list: async (): Promise<PerformanceCycle[]> => {
    const { data } = await apiRequest<PerformanceCycle[]>({ method: 'GET', url: '/performance-cycles' });
    return data;
  },
  create: async (input: CreatePerformanceCycleInput): Promise<PerformanceCycle> => {
    const { data } = await apiRequest<PerformanceCycle>({ method: 'POST', url: '/performance-cycles', data: input });
    return data;
  },
  update: async (id: string, input: UpdatePerformanceCycleInput): Promise<PerformanceCycle> => {
    const { data } = await apiRequest<PerformanceCycle>({ method: 'PATCH', url: `/performance-cycles/${id}`, data: input });
    return data;
  },
};

export const performanceCriteriaApi = {
  list: async (): Promise<PerformanceCriterion[]> => {
    const { data } = await apiRequest<PerformanceCriterion[]>({ method: 'GET', url: '/performance-criteria' });
    return data;
  },
  create: async (input: CreatePerformanceCriterionInput): Promise<PerformanceCriterion> => {
    const { data } = await apiRequest<PerformanceCriterion>({ method: 'POST', url: '/performance-criteria', data: input });
    return data;
  },
  update: async (id: string, input: UpdatePerformanceCriterionInput): Promise<PerformanceCriterion> => {
    const { data } = await apiRequest<PerformanceCriterion>({ method: 'PATCH', url: `/performance-criteria/${id}`, data: input });
    return data;
  },
  deactivate: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/performance-criteria/${id}` });
  },
};

export const performanceEvaluationsApi = {
  listForEmployee: async (employeeId: string): Promise<PerformanceEvaluation[]> => {
    const { data } = await apiRequest<PerformanceEvaluation[]>({ method: 'GET', url: `/performance-evaluations/employee/${employeeId}` });
    return data;
  },
  listForCycle: async (cycleId: string): Promise<PerformanceEvaluation[]> => {
    const { data } = await apiRequest<PerformanceEvaluation[]>({ method: 'GET', url: `/performance-evaluations/cycle/${cycleId}` });
    return data;
  },
  get: async (id: string): Promise<PerformanceEvaluation> => {
    const { data } = await apiRequest<PerformanceEvaluation>({ method: 'GET', url: `/performance-evaluations/${id}` });
    return data;
  },
  create: async (input: CreatePerformanceEvaluationInput): Promise<PerformanceEvaluation> => {
    const { data } = await apiRequest<PerformanceEvaluation>({ method: 'POST', url: '/performance-evaluations', data: input });
    return data;
  },
  update: async (id: string, input: UpdatePerformanceEvaluationInput): Promise<PerformanceEvaluation> => {
    const { data } = await apiRequest<PerformanceEvaluation>({ method: 'PATCH', url: `/performance-evaluations/${id}`, data: input });
    return data;
  },
  finalize: async (id: string): Promise<PerformanceEvaluation> => {
    const { data } = await apiRequest<PerformanceEvaluation>({ method: 'PATCH', url: `/performance-evaluations/${id}/finalize` });
    return data;
  },
};
