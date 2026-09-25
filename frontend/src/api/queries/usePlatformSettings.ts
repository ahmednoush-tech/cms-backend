import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformSettingsPublicApi } from '../endpoints/platformSettingsPublic';
import { platformAdminApi } from '../endpoints/platformAdmin';
import type { UpdatePlatformSettingsInput, UpdatePlatformStorageSettingsInput } from '../../types/entities/platformSettings';

/**
 * Used by EVERY screen that renders Mizan's own branding
 * (ProductBar, login/signup) — public, so this works before any
 * authentication exists.
 */
export function usePlatformSettingsPublic() {
  return useQuery({
    queryKey: ['platformSettings', 'public'],
    queryFn: () => platformSettingsPublicApi.get(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdatePlatformSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePlatformSettingsInput) => platformAdminApi.updateSettings(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platformSettings', 'public'] }),
  });
}

export function useUploadPlatformLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => platformAdminApi.uploadLogo(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platformSettings', 'public'] }),
  });
}

export function usePlatformStorageSettings() {
  return useQuery({ queryKey: ['platformStorageSettings'], queryFn: () => platformAdminApi.getStorageSettings() });
}

export function useUpdatePlatformStorageSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePlatformStorageSettingsInput) => platformAdminApi.updateStorageSettings(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platformStorageSettings'] }),
  });
}
