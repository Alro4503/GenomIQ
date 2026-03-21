'use client';

import React from 'react';
import { useTranslation } from '@/context/TranslationProvider'; 

const Features: React.FC = () => {
    const { t } = useTranslation();

    const features = [
        {
            id: 1,
            title: t('home.features.feature1.title'),
            description: t('home.features.feature1.description'),
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-[#55A63F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
            ),
        },
        {
            id: 2,
            title: t('home.features.feature2.title'),
            description: t('home.features.feature2.description'),
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-[#55A63F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
            ),
        },
        {
            id: 3,
            title: t('home.features.feature3.title'),
            description: t('home.features.feature3.description'),
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-[#55A63F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
            ),
        }
    ];

    return (
        <section id="features" className="py-16 bg-neutral-50 dark:bg-neutral-800">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold mb-2 relative inline-block">
                        {t('home.features.title')}
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-[#1F734C] via-[#55A63F] to-[#A7D93D]"></div>
                    </h2>
                    <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto mt-4">
                        {t('home.features.subtitle')}
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature) => (
                        <div
                            key={feature.id}
                            className="bg-white dark:bg-neutral-700 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 p-6 flex flex-col items-center text-center transform hover:-translate-y-1"
                        >
                            <div className="mb-4 bg-[#F5FBF2] dark:bg-[#2A3B2C] p-4 rounded-full">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                            <p className="text-neutral-600 dark:text-neutral-300">{feature.description}</p>
                        </div>
                    ))}
                </div>
                
                <div className="text-center mt-12">
                    <p className="text-neutral-500 dark:text-neutral-400 mb-4">{t('home.features.moreInfo')}</p>
                    <button className="inline-flex items-center text-[#55A63F] hover:text-[#4A9136] font-medium">
                        {t('common.more')}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        </section>
    );
};

export default Features;