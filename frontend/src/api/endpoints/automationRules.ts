import { apiRequest } from '../client';
import type { AutomationRule, CreateAutomationRuleInput, UpdateAutomationRuleInput } from '../../types/entities/automationRule';

/** Confirmed 1:1 against backend/src/modules/automation-rules/automation-rules.controller.ts. */
export const automationRulesApi = {
  list: async (): Promise<AutomationRule[]> => {
    const { data } = await apiRequest<AutomationRule[]>({ method: 'GET', url: '/automation-rules' });
    return data;
  },
  get: async (id: string): Promise<AutomationRule> => {
    const { data } = await apiRequest<AutomationRule>({ method: 'GET', url: `/automation-rules/${id}` });
    return data;
  },
  create: async (input: CreateAutomationRuleInput): Promise<AutomationRule> => {
    const { data } = await apiRequest<AutomationRule>({ method: 'POST', url: '/automation-rules', data: input });
    return data;
  },
  update: async (id: string, input: UpdateAutomationRuleInput): Promise<AutomationRule> => {
    const { data } = await apiRequest<AutomationRule>({ method: 'PATCH', url: `/automation-rules/${id}`, data: input });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/automation-rules/${id}` });
  },
};
