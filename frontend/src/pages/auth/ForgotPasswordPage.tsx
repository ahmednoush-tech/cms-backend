import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/endpoints/auth';
import { FormField, TextInput } from '../../components/Form/FormField';
import { getBrandingConfig } from '../../config/branding';
import { usePlatformSettingsPublic } from '../../api/queries/usePlatformSettings';

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'validation.required').email('validation.email'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

/**
 * Deliberately shows the exact same success message whether or
 * not the email matched an account — the backend itself never
 * reveals this either (see AuthService.forgotPassword), so the
 * frontend has nothing more specific it could honestly show.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation(['auth', 'common']);
  const branding = getBrandingConfig();
  const { data: platformSettings } = usePlatformSettingsPublic();
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setIsSubmitting(true);
    try {
      await authApi.forgotPassword(values.email);
    } finally {
      // Always show the success state, even on a network/API error —
      // this endpoint never reveals whether the email existed, and
      // an error here would only leak that distinction by omission.
      setIsSubmitting(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src={platformSettings?.logoUrl ?? branding.logoUrl} alt={platformSettings?.productName ?? t('common:productName')} className="h-10" onError={(e) => (e.currentTarget.style.display = 'none')} />
          <h1 className="text-lg font-semibold text-ink">{t('auth:forgotPassword.title')}</h1>
          {!submitted && <p className="text-sm text-ink-muted">{t('auth:forgotPassword.subtitle')}</p>}
        </div>

        {submitted ? (
          <div className="text-center">
            <p className="mb-6 text-sm text-ink">{t('auth:forgotPassword.successMessage')}</p>
            <Link to="/login" className="text-sm font-medium text-primary hover:underline">
              {t('auth:forgotPassword.backToLogin')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <FormField label={t('auth:login.email')} htmlFor="email" required error={errors.email && t(`common:${errors.email.message}`)}>
              <TextInput id="email" type="email" autoComplete="email" hasError={!!errors.email} {...register('email')} />
            </FormField>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? t('common:action.processing') : t('auth:forgotPassword.submit')}
            </button>

            <div className="mt-4 text-center">
              <Link to="/login" className="text-sm text-ink-muted hover:text-ink hover:underline">
                {t('auth:forgotPassword.backToLogin')}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
