import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { emailIntegrationApi } from '../endpoints/emailIntegration';

export function useEmailIntegrationStatus() {
  return useQuery({ queryKey: ['emailIntegration', 'status'], queryFn: () => emailIntegrationApi.getStatus() });
}

export function useConnectEmailIntegration() {
  return useMutation({ mutationFn: () => emailIntegrationApi.getConnectUrl() });
}

export function useSyncEmailIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => emailIntegrationApi.sync(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['emailIntegration', 'status'] }),
  });
}

export function useDisconnectEmailIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => emailIntegrationApi.disconnect(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['emailIntegration', 'status'] }),
  });
}
