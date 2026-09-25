import { apiRequest } from '../client';
import type { CompanyInfo, UpdateCompanySettingsInput, MicrosoftIntegrationSettings, UpdateMicrosoftIntegrationInput } from '../../types/entities/companySettings';

/** Confirmed 1:1 against backend/src/modules/company-settings/company-settings.controller.ts. */
export const companySettingsApi = {
  get: async (): Promise<CompanyInfo> => {
    const { data } = await apiRequest<CompanyInfo>({ method: 'GET', url: '/company-settings' });
    return data;
  },
  update: async (input: UpdateCompanySettingsInput): Promise<CompanyInfo> => {
    const { data } = await apiRequest<CompanyInfo>({ method: 'PATCH', url: '/company-settings', data: input });
    return data;
  },
  uploadLogo: async (file: File): Promise<CompanyInfo> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiRequest<CompanyInfo>({ method: 'POST', url: '/company-settings/logo', data: formData });
    return data;
  },
  getMicrosoftIntegration: async (): Promise<MicrosoftIntegrationSettings> => {
    const { data } = await apiRequest<MicrosoftIntegrationSettings>({ method: 'GET', url: '/company-settings/microsoft-integration' });
    return data;
  },
  updateMicrosoftIntegration: async (input: UpdateMicrosoftIntegrationInput): Promise<MicrosoftIntegrationSettings> => {
    const { data } = await apiRequest<MicrosoftIntegrationSettings>({ method: 'PATCH', url: '/company-settings/microsoft-integration', data: input });
    return data;
  },
};

/**
 * The unauthenticated counterpart of companySettingsApi.get() —
 * for screens rendered before login (LoginPage,
 * ForgotPasswordPage, ResetPasswordPage). Returns only { name,
 * logo }, matching exactly what backend/.../public-company-info
 * exposes; there is no reason a pre-login screen would need
 * anything more sensitive.
 */
export const publicCompanyInfoApi = {
  get: async (): Promise<Pick<CompanyInfo, 'name' | 'logo'>> => {
    const { data } = await apiRequest<Pick<CompanyInfo, 'name' | 'logo'>>({ method: 'GET', url: '/public/company-info' });
    return data;
  },
};
