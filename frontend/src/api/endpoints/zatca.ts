import { apiRequest } from '../client';
import type { ZatcaCertificateSummary, GenerateZatcaCsrInput, ZatcaCsrResult } from '../../types/entities/zatca';

export const zatcaApi = {
  listCertificates: async (): Promise<ZatcaCertificateSummary[]> => {
    const { data } = await apiRequest<ZatcaCertificateSummary[]>({ method: 'GET', url: '/zatca/certificates' });
    return data;
  },
  generateCsr: async (input: GenerateZatcaCsrInput): Promise<ZatcaCsrResult> => {
    const { data } = await apiRequest<ZatcaCsrResult>({ method: 'POST', url: '/zatca/certificates/csr', data: input });
    return data;
  },
  requestComplianceCsid: async (certificateId: string, otp: string): Promise<ZatcaCertificateSummary> => {
    const { data } = await apiRequest<ZatcaCertificateSummary>({
      method: 'POST',
      url: `/zatca/certificates/${certificateId}/compliance-csid`,
      data: { otp },
    });
    return data;
  },
  requestProductionCsid: async (certificateId: string): Promise<ZatcaCertificateSummary> => {
    const { data } = await apiRequest<ZatcaCertificateSummary>({ method: 'POST', url: `/zatca/certificates/${certificateId}/production-csid` });
    return data;
  },
};
