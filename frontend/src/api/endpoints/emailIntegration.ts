import { apiRequest } from '../client';
import type { EmailIntegrationStatus, EmailSyncResult } from '../../types/entities/emailIntegration';

/** Confirmed 1:1 against backend/src/modules/email-integration/email-integration.controller.ts. */
export const emailIntegrationApi = {
  getStatus: async (): Promise<EmailIntegrationStatus> => {
    const { data } = await apiRequest<EmailIntegrationStatus>({ method: 'GET', url: '/email-integration/status' });
    return data;
  },
  /** Returns Microsoft's own authorization URL — the caller navigates the browser there itself. */
  getConnectUrl: async (): Promise<{ url: string }> => {
    const { data } = await apiRequest<{ url: string }>({ method: 'GET', url: '/email-integration/connect' });
    return data;
  },
  sync: async (): Promise<EmailSyncResult> => {
    const { data } = await apiRequest<EmailSyncResult>({ method: 'POST', url: '/email-integration/sync' });
    return data;
  },
  disconnect: async (): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: '/email-integration/disconnect' });
  },
};
