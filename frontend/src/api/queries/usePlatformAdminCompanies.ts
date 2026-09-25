import { useQuery } from '@tanstack/react-query';
import { platformAdminApi } from '../endpoints/platformAdmin';

export function usePlatformAdminCompanies() {
  return useQuery({ queryKey: ['platformAdmin', 'companies'], queryFn: () => platformAdminApi.listCompanies() });
}

export function usePlatformAdminCompanyDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['platformAdmin', 'companies', id],
    queryFn: () => platformAdminApi.getCompanyDetail(id!),
    enabled: !!id,
  });
}
