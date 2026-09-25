import { apiRequest, apiClient } from '../client';
import type {
  ReportDefinition,
  CreateReportDefinitionInput,
  UpdateReportDefinitionInput,
  ReportResultPoint,
  ReportsRegistryMetadata,
} from '../../types/entities/report';

/** Confirmed 1:1 against backend/src/modules/reports/*.controller.ts. */
export const reportsMetadataApi = {
  get: async (): Promise<ReportsRegistryMetadata> => {
    const { data } = await apiRequest<ReportsRegistryMetadata>({ method: 'GET', url: '/reports-metadata' });
    return data;
  },
};

export const reportDefinitionsApi = {
  list: async (): Promise<ReportDefinition[]> => {
    const { data } = await apiRequest<ReportDefinition[]>({ method: 'GET', url: '/report-definitions' });
    return data;
  },
  get: async (id: string): Promise<ReportDefinition> => {
    const { data } = await apiRequest<ReportDefinition>({ method: 'GET', url: `/report-definitions/${id}` });
    return data;
  },
  create: async (input: CreateReportDefinitionInput): Promise<ReportDefinition> => {
    const { data } = await apiRequest<ReportDefinition>({ method: 'POST', url: '/report-definitions', data: input });
    return data;
  },
  update: async (id: string, input: UpdateReportDefinitionInput): Promise<ReportDefinition> => {
    const { data } = await apiRequest<ReportDefinition>({ method: 'PATCH', url: `/report-definitions/${id}`, data: input });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/report-definitions/${id}` });
  },
  run: async (id: string): Promise<ReportResultPoint[]> => {
    const { data } = await apiRequest<ReportResultPoint[]>({ method: 'GET', url: `/report-definitions/${id}/run` });
    return data;
  },
  preview: async (input: CreateReportDefinitionInput): Promise<ReportResultPoint[]> => {
    const { data } = await apiRequest<ReportResultPoint[]>({ method: 'POST', url: '/report-definitions/preview', data: input });
    return data;
  },
  /**
   * Same Bearer-authenticated blob-fetch approach as
   * attachmentsApi.download() — the export endpoint requires auth,
   * so a plain <a href> (which can't carry an Authorization header)
   * would just 401. The `download` attribute on the generated link
   * decides the saved filename for a blob URL, so the report's real
   * name (Arabic included) is used directly here, stripped only of
   * characters that are illegal in filenames.
   */
  exportCsv: async (id: string, reportName: string): Promise<void> => {
    const response = await apiClient.get(`/report-definitions/${id}/export.csv`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }));
    const safeName = reportName.replace(/[\\/:*?"<>|\r\n]/g, '').trim() || 'report';
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
