import { useQuery } from '@tanstack/react-query';
import { publicQuotationApi } from '../endpoints/publicQuotation';

export function usePublicQuotation(token: string | undefined) {
  return useQuery({
    queryKey: ['publicQuotation', token],
    queryFn: () => publicQuotationApi.getByToken(token!),
    enabled: !!token,
    retry: false,
  });
}
