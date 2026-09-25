export type AutomationTriggerEntityType = 'lead' | 'opportunity';
export type AutomationTriggerEvent = 'created' | 'stage_changed';

export interface AutomationRule {
  id: string;
  companyId: string;
  name: string;
  isActive: boolean;
  triggerEntityType: AutomationTriggerEntityType;
  triggerEvent: AutomationTriggerEvent;
  triggerToStage: string | null;
  notificationTitle: string;
  notificationMessage: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutomationRuleInput {
  name: string;
  isActive?: boolean;
  triggerEntityType: AutomationTriggerEntityType;
  triggerEvent: AutomationTriggerEvent;
  triggerToStage?: string;
  notificationTitle: string;
  notificationMessage?: string;
}

export interface UpdateAutomationRuleInput {
  name?: string;
  isActive?: boolean;
  triggerEntityType?: AutomationTriggerEntityType;
  triggerEvent?: AutomationTriggerEvent;
  triggerToStage?: string;
  notificationTitle?: string;
  notificationMessage?: string;
}
