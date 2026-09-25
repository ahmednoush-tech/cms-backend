import { useQuery } from '@tanstack/react-query';
import { crmTimelineApi } from '../endpoints/crmTimeline';

export function useCustomerTimeline(customerId: string | undefined) {
  return useQuery({
    queryKey: ['crmTimeline', 'customer', customerId],
    queryFn: () => crmTimelineApi.getCustomerTimeline(customerId!),
    enabled: !!customerId,
  });
}

export function useLeadTimeline(leadId: string | undefined) {
  return useQuery({
    queryKey: ['crmTimeline', 'lead', leadId],
    queryFn: () => crmTimelineApi.getLeadTimeline(leadId!),
    enabled: !!leadId,
  });
}
