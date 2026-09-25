import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companySettingsApi, publicCompanyInfoApi } from '../endpoints/companySettings';
import type { UpdateCompanySettingsInput, UpdateMicrosoftIntegrationInput } from '../../types/entities/companySettings';

/**
 * The single live source of the company's own info for anything
 * rendered in the app — replaces the deploy-time VITE_BRAND_*
 * environment variables for every consumer that gets migrated to it.
 */
export function useCompanyInfo() {
  return useQuery({ queryKey: ['companySettings'], queryFn: () => companySettingsApi.get(), staleTime: 5 * 60 * 1000 });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCompanySettingsInput) => companySettingsApi.update(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companySettings'] }),
  });
}

export function useUploadCompanyLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => companySettingsApi.uploadLogo(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companySettings'] }),
  });
}

/** For pre-login screens only — see publicCompanyInfoApi. */
export function usePublicCompanyInfo() {
  return useQuery({ queryKey: ['publicCompanyInfo'], queryFn: () => publicCompanyInfoApi.get(), staleTime: 5 * 60 * 1000 });
}

export function useMicrosoftIntegrationSettings() {
  return useQuery({ queryKey: ['companySettings', 'microsoftIntegration'], queryFn: () => companySettingsApi.getMicrosoftIntegration() });
}

export function useUpdateMicrosoftIntegrationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMicrosoftIntegrationInput) => companySettingsApi.updateMicrosoftIntegration(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companySettings', 'microsoftIntegration'] }),
  });
}
