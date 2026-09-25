import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCreateVehicle } from '../../api/queries/useVehicles';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { FormField, TextInput } from '../../components/Form/FormField';
import { ApiError } from '../../api/client';

const vehicleSchema = z.object({
  plateNumber: z.string().min(1, 'validation.required'),
  make: z.string().min(1, 'validation.required'),
  model: z.string().min(1, 'validation.required'),
  year: z.string().optional(),
  vin: z.string().optional(),
  odometerReading: z.string().optional(),
  registrationExpiryDate: z.string().optional(),
  insuranceExpiryDate: z.string().optional(),
  notes: z.string().optional(),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

export function CreateVehiclePage() {
  const { t } = useTranslation(['fleet', 'common']);
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createMutation = useCreateVehicle();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VehicleFormValues>({ resolver: zodResolver(vehicleSchema) });

  const onSubmit = (values: VehicleFormValues) => {
    setSubmitError(null);
    createMutation.mutate(
      {
        plateNumber: values.plateNumber,
        make: values.make,
        model: values.model,
        year: values.year ? Number(values.year) : undefined,
        vin: values.vin || undefined,
        odometerReading: values.odometerReading ? Number(values.odometerReading) : undefined,
        registrationExpiryDate: values.registrationExpiryDate || undefined,
        insuranceExpiryDate: values.insuranceExpiryDate || undefined,
        notes: values.notes || undefined,
      },
      {
        onSuccess: (vehicle) => navigate(`/fleet/vehicles/${vehicle.id}`),
        onError: (err) => setSubmitError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  return (
    <div>
      <PageHeader title={t('fleet:form.createTitle')} breadcrumb={t('fleet:title')} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-2xl rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('fleet:fields.plateNumber')} htmlFor="plateNumber" required error={errors.plateNumber && t(`common:${errors.plateNumber.message}`)}>
            <TextInput id="plateNumber" hasError={!!errors.plateNumber} {...register('plateNumber')} />
          </FormField>
          <FormField label={t('fleet:fields.vin')} htmlFor="vin">
            <TextInput id="vin" {...register('vin')} />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <FormField label={t('fleet:fields.make')} htmlFor="make" required error={errors.make && t(`common:${errors.make.message}`)}>
            <TextInput id="make" hasError={!!errors.make} {...register('make')} />
          </FormField>
          <FormField label={t('fleet:fields.model')} htmlFor="model" required error={errors.model && t(`common:${errors.model.message}`)}>
            <TextInput id="model" hasError={!!errors.model} {...register('model')} />
          </FormField>
          <FormField label={t('fleet:fields.year')} htmlFor="year">
            <TextInput id="year" type="number" {...register('year')} />
          </FormField>
        </div>

        <FormField label={t('fleet:fields.odometerReading')} htmlFor="odometerReading" hint={t('fleet:form.odometerHint')}>
          <TextInput id="odometerReading" type="number" min="0" {...register('odometerReading')} />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('fleet:fields.registrationExpiryDate')} htmlFor="registrationExpiryDate">
            <TextInput id="registrationExpiryDate" type="date" {...register('registrationExpiryDate')} />
          </FormField>
          <FormField label={t('fleet:fields.insuranceExpiryDate')} htmlFor="insuranceExpiryDate">
            <TextInput id="insuranceExpiryDate" type="date" {...register('insuranceExpiryDate')} />
          </FormField>
        </div>

        <FormField label={t('fleet:fields.notes')} htmlFor="notes">
          <textarea id="notes" {...register('notes')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>

        {submitError && <p className="mt-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{submitError}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => navigate('/fleet/vehicles')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button type="submit" disabled={createMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {createMutation.isPending ? t('common:action.processing') : t('common:action.create')}
          </button>
        </div>
      </form>
    </div>
  );
}
