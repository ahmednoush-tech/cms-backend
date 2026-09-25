import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zatcaApi } from '../endpoints/zatca';
import type { GenerateZatcaCsrInput } from '../../types/entities/zatca';

export function useZatcaCertificates() {
  return useQuery({ queryKey: ['zatca', 'certificates'], queryFn: () => zatcaApi.listCertificates() });
}

export function useGenerateZatcaCsr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateZatcaCsrInput) => zatcaApi.generateCsr(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zatca', 'certificates'] }),
  });
}

export function useRequestZatcaComplianceCsid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ certificateId, otp }: { certificateId: string; otp: string }) => zatcaApi.requestComplianceCsid(certificateId, otp),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zatca', 'certificates'] }),
  });
}

export function useRequestZatcaProductionCsid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (certificateId: string) => zatcaApi.requestProductionCsid(certificateId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zatca', 'certificates'] }),
  });
}
