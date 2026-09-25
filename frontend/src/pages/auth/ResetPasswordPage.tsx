import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/endpoints/auth';
import { ApiError } from '../../api/client';
import { FormField, TextInput } from '../../components/Form/FormField';
import { getBrandingConfig } from '../../config/branding';
import { usePlatformSettingsPublic } from '../../api/queries/usePlatformSettings';
import { PASSWORD_MIN_LENGTH, PASSWORD_STRENGTH_REGEX } from '../../lib/passwordPolicy';

// Only `password` needs the complexity rule — confirmPassword just
// has to match it, which the .refine() below already checks.
const resetPasswordSchema = z
  .object({
    password: z.string().min(PASSWORD_MIN_LENGTH, 'validation.minLength').regex(PASSWORD_STRENGTH_REGEX, 'validation.passwordStrength'),
    confirmPassword: z.string().min(PASSWORD_MIN_LENGTH, 'validation.minLength'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'validation.passwordsMustMatch',
    path: ['confirmPassword'],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const { t } = useTranslation(['auth', 'common']);
  const branding = getBrandingConfig();
  const { data: platformSettings } = usePlatformSettingsPublic();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!token) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await authApi.resetPassword(token, values.password);
      setSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : t('common:error.generic'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src={platformSettings?.logoUrl ?? branding.logoUrl} alt={platformSettings?.productName ?? t('common:productName')} className="h-10" onError={(e) => (e.currentTarget.style.display = 'none')} />
          <h1 className="text-lg font-semibold text-ink">{t('auth:resetPassword.title')}</h1>
        </div>

        {!token ? (
          <p className="text-center text-sm text-danger" role="alert">
            {t('auth:resetPassword.missingToken')}
          </p>
        ) : success ? (
          <div className="text-center">
            <p className="mb-6 text-sm text-ink">{t('auth:resetPassword.successMessage')}</p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90"
            >
              {t('auth:forgotPassword.backToLogin')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <FormField
              label={t('auth:resetPassword.newPassword')}
              htmlFor="password"
              required
              error={errors.password && t(`common:${errors.password.message}`)}
            >
              <TextInput id="password" type="password" autoComplete="new-password" hasError={!!errors.password} {...register('password')} />
            </FormField>
            <FormField
              label={t('auth:resetPassword.confirmPassword')}
              htmlFor="confirmPassword"
              required
              error={errors.confirmPassword && t(`common:${errors.confirmPassword.message}`)}
            >
              <TextInput
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                hasError={!!errors.confirmPassword}
                {...register('confirmPassword')}
              />
            </FormField>

            {submitError && (
              <p className="mb-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? t('common:action.processing') : t('auth:resetPassword.submit')}
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
