'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/context/TranslationProvider';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import GoogleButton from './GoogleButton';

const RegisterForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});
  const [processingOAuth, setProcessingOAuth] = useState(false);

  const { register, setToken, loading, error } = useAuth();
  const { t, language } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Procesar callback de OAuth si hay un código en la URL
  useEffect(() => {
    const code = searchParams?.get('code');
    const state = searchParams?.get('state');

    if (code && state) {
      handleOAuthCallback(code, state);
    }
  }, [searchParams]);

  const handleOAuthCallback = async (code: string, state: string) => {
    try {
      setProcessingOAuth(true);

      // Llamar al endpoint de callback para completar autenticación
      const response = await fetch(`/api/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Error completing Google authentication');
      }

      const data = await response.json();

      // Guardar token y redirigir
      if (data.access_token) {
        setToken(data.access_token);
        router.push('/dashboard');
      }

    } catch (error) {
      console.error('OAuth callback error:', error);
    } finally {
      setProcessingOAuth(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string; fullName?: string } = {};

    // Validate email
    if (!email) {
      newErrors.email = t('auth.validation.emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t('auth.validation.emailInvalid');
    }

    // Validate password
    if (!password) {
      newErrors.password = t('auth.validation.passwordRequired');
    } else if (password.length < 8) {
      newErrors.password = t('auth.validation.passwordLength');
    }

    // Validate full name
    if (!fullName) {
      newErrors.fullName = t('auth.validation.fullNameRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await register(email, password, fullName, language);
    } catch (err) {
      console.error('Registration error:', err);
    }
  };

  if (processingOAuth) {
    return (
      <div className="card max-w-md mx-auto">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-12 h-12 rounded-full border-4 border-t-[#55A63F] border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">{t('auth.processingRegistration')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card max-w-md mx-auto">
      <h1 className="text-3xl font-semibold mb-6 text-center">{t('auth.register.title')}</h1>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-md mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Input
          label={t('auth.register.fullNameLabel')}
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
          placeholder="John Doe"
          disabled={loading}
          fullWidth
          leftIcon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />

        <Input
          label={t('auth.register.emailLabel')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          placeholder="example@email.com"
          disabled={loading}
          fullWidth
          leftIcon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        />

        <Input
          label={t('auth.register.passwordLabel')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          placeholder="••••••••"
          disabled={loading}
          fullWidth
          leftIcon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          }
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={loading}
          fullWidth
          className="mt-2"
        >
          {t('auth.register.submitButton')}
        </Button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-200 dark:border-neutral-800"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400">
              {t('auth.orContinueWith')}
            </span>
          </div>
        </div>

        <GoogleButton />
      </form>

      <div className="mt-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
        {t('auth.register.loginLink')}{' '}
        <Link href="/auth/login" className="text-[#55A63F] hover:underline">
          {t('nav.login')}
        </Link>
      </div>
    </div>
  );
};

export default RegisterForm;