export interface CompanyInfo {
  id: string;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  taxNumber: string | null;
  status: string;
}

export interface UpdateCompanySettingsInput {
  name?: string;
  legalName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  taxNumber?: string;
}

export interface MicrosoftIntegrationSettings {
  clientId: string | null;
  /** Whether a secret has been saved — the secret's value itself is never sent to the frontend, not even encrypted. */
  secretConfigured: boolean;
}

export interface UpdateMicrosoftIntegrationInput {
  clientId: string;
  /** Omit to leave the previously saved secret unchanged. */
  clientSecret?: string;
}
