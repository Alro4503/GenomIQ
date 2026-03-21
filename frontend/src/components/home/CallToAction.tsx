'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationProvider';
import Button from '@/components/ui/Button';

const CallToAction: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <section className="py-16 bg-gradient-to-r from-[#1F734C] via-[#55A63F] to-[#A7D93D]">
      <div className="container mx-auto px-4">
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-2xl p-8 md:p-12 max-w-4xl mx-auto relative overflow-hidden">

          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">{t('home.cta.title')}</h2>
            <p className="text-neutral-600 dark:text-neutral-300 mb-6 max-w-2xl mx-auto">
              {t('home.cta.description')}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button
                variant="primary"
                size="lg"
                onClick={() => router.push('/auth/register')}
                className="shadow-lg"
              >
                {t('home.cta.registerButton')}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push('/auth/login')}
              >
                {t('home.cta.loginButton')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;