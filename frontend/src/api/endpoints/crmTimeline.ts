import { apiRequest } from '../client';
import type { TimelineEvent } from '../../types/entities/crmTimeline';

/** Confirmed 1:1 against backend/src/modules/crm-timeline/crm-timeline.controller.ts. */
export const crmTimelineApi = {
  getCustomerTimeline: async (customerId: string): Promise<TimelineEvent[]> => {
    const { data } = await apiRequest<TimelineEvent[]>({ method: 'GET', url: `/crm-timeline/customer/${customerId}` });
    return data;
  },
  getLeadTimeline: async (leadId: string): Promise<TimelineEvent[]> => {
    const { data } = await apiRequest<TimelineEvent[]>({ method: 'GET', url: `/crm-timeline/lead/${leadId}` });
    return data;
  },
};
