import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { useSignup } from '../../api/queries/useSignup';
import { ApiError } from '../../api/client';
import { FormField, TextInput } from '../../components/Form/FormField';
import { getBrandingConfig } from '../../config/branding';
import { usePlatformSettingsPublic } from '../../api/queries/usePlatformSettings';
import { PASSWORD_MIN_LENGTH, PASSWORD_STRENGTH_REGEX } from '../../lib/passwordPolicy';

const signupSchema = z.object({
  companyName: z.string().min(1, 'validation.required'),
  adminName: z.string().min(1, 'validation.required'),
  adminEmail: z.string().min(1, 'validation.required').email('validation.email'),
  adminPassword: z.string().min(PASSWORD_MIN_LENGTH, 'validation.minLength').regex(PASSWORD_STRENGTH_REGEX, 'validation.passwordStrength'),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupPage() {
  const { t } = useTranslation(['auth', 'common']);
  const { login } = useAuth();
  const navigate = useNavigate();
  const signupMutation = useSignup();
  const branding = getBrandingConfig();
  const { data: platformSettings } = usePlatformSettingsPublic();

  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({ resolver: zodResolver(signupSchema) });

  const onSubmit = async (values: SignupFormValues) => {
    setSubmitError(null);
    signupMutation.mutate(values, {
      onSuccess: async () => {
        setIsLoggingIn(true);
        try {
          await login(values.adminEmail, values.adminPassword);
          navigate('/dashboard', { replace: true });
        } catch {
          navigate('/login', { replace: true });
        } finally {
          setIsLoggingIn(false);
        }
      },
      onError: (err) => {
        setSubmitError(err instanceof ApiError ? err.message : t('common:error.generic'));
      },
    });
  };

  const isSubmitting = signupMutation.isPending || isLoggingIn;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src={platformSettings?.logoUrl ?? branding.logoUrl} alt={platformSettings?.productName ?? t('common:productName')} className="h-10" onError={(e) => (e.currentTarget.style.display = 'none')} />
          <h1 className="text-lg font-semibold text-ink">{t('auth:signup.title')}</h1>
          <p className="text-sm text-ink-muted">{t('auth:signup.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label={t('auth:signup.companyName')} htmlFor="companyName" required error={errors.companyName && t(`common:${errors.companyName.message}`)}>
            <TextInput id="companyName" hasError={!!errors.companyName} {...register('companyName')} />
          </FormField>

          <FormField label={t('auth:signup.adminName')} htmlFor="adminName" required error={errors.adminName && t(`common:${errors.adminName.message}`)}>
            <TextInput id="adminName" hasError={!!errors.adminName} {...register('adminName')} />
          </FormField>

          <FormField label={t('auth:signup.adminEmail')} htmlFor="adminEmail" required error={errors.adminEmail && t(`common:${errors.adminEmail.message}`)}>
            <TextInput id="adminEmail" type="email" autoComplete="email" hasError={!!errors.adminEmail} {...register('adminEmail')} />
          </FormField>

          <FormField label={t('auth:signup.adminPassword')} htmlFor="adminPassword" required error={errors.adminPassword && t(`common:${errors.adminPassword.message}`)}>
            <div className="relative">
              <TextInput
                id="adminPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                hasError={!!errors.adminPassword}
                {...register('adminPassword')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 end-2 text-xs text-ink-muted hover:text-ink"
                aria-label={showPassword ? t('auth:login.hidePassword') : t('auth:login.showPassword')}
              >
                {showPassword ? t('auth:login.hidePassword') : t('auth:login.showPassword')}
              </button>
            </div>
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
            {isSubmitting ? t('common:action.processing') : t('auth:signup.submit')}
          </button>

          <p className="mt-4 text-center text-xs text-ink-muted">
            {t('auth:signup.haveAccount')}{' '}
            <Link to="/login" className="text-ink hover:underline">
              {t('auth:signup.logInLink')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
