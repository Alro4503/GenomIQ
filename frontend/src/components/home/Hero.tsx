'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationProvider';
import Button from '@/components/ui/Button';

const Hero: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const [message, setMessage] = useState<string>('');
  
  // Handle form submission - redirect to login
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      router.push('/auth/login');
    }
  };
  
  // Handle keys (Enter to send)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };
  
  return (
    <div className="relative bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="relative z-10 pb-8 bg-white dark:bg-neutral-900 sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
          <svg
            className="hidden lg:block absolute right-0 inset-y-0 h-full w-48 text-white dark:text-neutral-900 transform translate-x-1/2"
            fill="currentColor"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon points="50,0 100,0 50,100 0,100" />
          </svg>

          <main className="pt-10 mx-auto max-w-7xl px-4 sm:pt-12 sm:px-6 md:pt-16 lg:pt-20 lg:px-8 xl:pt-28">
            <div className="sm:text-center lg:text-left">
              <h1 className="text-4xl tracking-tight font-extrabold text-neutral-900 dark:text-white sm:text-5xl md:text-6xl flex items-center flex-wrap sm:justify-center lg:justify-start">
                <div className="flex items-center">
                  <div className="relative h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 mr-1">
                    <Image
                      src="/logo-genomiq.jpg"
                      alt="G"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <span className="text-neutral-700 dark:text-neutral-300">enom</span>
                  <span className="text-[#55A63F]">IQ</span>
                </div>
              </h1>
              <p className="mt-3 text-base text-neutral-600 dark:text-neutral-300 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                {t('home.hero.subtitle')}
              </p>
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 sm:text-base sm:max-w-xl sm:mx-auto lg:mx-0">
                {t('home.hero.description')}
              </p>
              <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                <div className="rounded-md">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => router.push('/auth/register')}
                    className="shadow-lg"
                  >
                    {t('home.hero.ctaButton')}
                  </Button>
                </div>
                <div className="mt-3 sm:mt-0 sm:ml-3">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => router.push('/tools')}
                  >
                    {t('home.hero.secondaryCta')}
                  </Button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
      <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
        <div className="h-56 w-full bg-gradient-to-r from-[#1F734C] via-[#55A63F] to-[#A7D93D] sm:h-72 md:h-96 lg:w-full lg:h-full flex flex-col items-center justify-center">
          <h3 className="text-white text-2xl font-semibold mb-5 text-center">
            {t('home.hero.tryAiTitle')}
          </h3>
          <div className="w-3/4 h-auto p-4 bg-white bg-opacity-10 rounded-lg backdrop-filter backdrop-blur-sm border border-white border-opacity-20 shadow-2xl">
            <form onSubmit={handleSubmit}>
              <div className="flex items-center">
                <textarea
                  className="flex-grow bg-white bg-opacity-20 border border-white border-opacity-30 rounded-lg resize-none py-3 px-4 text-white placeholder-white placeholder-opacity-75 focus:ring-white focus:border-white"
                  rows={3}
                  placeholder={t('home.hero.inputPlaceholder')}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{ minHeight: '80px' }}
                />
                
                <button
                  type="submit"
                  className="ml-3 h-16 w-16 flex-shrink-0 text-white hover:text-gray-200 flex items-center justify-center transition-all"
                  disabled={!message.trim()}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;