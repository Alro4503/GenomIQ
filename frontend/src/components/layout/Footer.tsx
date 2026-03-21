'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslation } from '@/context/TranslationProvider';
import { useAuth } from '@/context/AuthContext';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';

const Footer: React.FC = () => {
    const { t } = useTranslation();
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 py-8">
            <div className="container mx-auto px-4 max-w-[1400px]">
                <div className="flex flex-col md:flex-row justify-between items-center">
                    {/* Logo and Copyright */}
                    <div className="w-full md:w-2/5 flex flex-col items-center md:items-start mb-4 md:mb-0">
                        <Link href="/" className="genomiq-logo">
                            <Image 
                                src="/logo-genomiq.jpg" 
                                alt="GenomIQ Logo" 
                                width={140} 
                                height={42} 
                                className="h-9 w-auto" 
                            />
                        </Link>
                        <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-2">
                            © {currentYear} GenomIQ. {t('common.copyright')}
                        </p>
                    </div>

                    {/* Center content - Theme Toggle and Language Switcher (SIEMPRE VISIBLE) */}
                    <div className="w-full md:w-1/5 flex justify-center items-center space-x-4 mb-4 md:mb-0">
                        <LanguageSwitcher />
                        <ThemeToggle />
                    </div>

                    {/* GitLab Logo */}
                    <div className="w-full md:w-2/5 flex justify-center md:justify-end">
                        <a 
                            href="https://gitlab.com/provencat/dawbio/genomiq" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-neutral-700 dark:text-neutral-300 hover:text-[#55A63F] dark:hover:text-[#55A63F] transition-colors"
                            aria-label="GitLab"
                        >
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                width="24" 
                                height="24" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                className="h-6 w-6"
                            >
                                <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"></path>
                            </svg>
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;