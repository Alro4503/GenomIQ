'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';

// Supported languages
export type Language = 'en' | 'es';

// Translation interface
export interface Translations {
    [key: string]: string | Translations;
}

// Context interface
interface TranslationContextType {
    t: (key: string, params?: Record<string, string>) => string;
    language: Language;
    changeLanguage: (newLanguage: Language) => void;
    isLoaded: boolean;
}

// Create context
const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

// Get nested translation value
const getNestedTranslation = (obj: any, path: string): string => {
    const keys = path.split('.');
    let current: any = obj;

    for (const key of keys) {
        if (!current || current[key] === undefined) {
            console.warn(`Translation key not found: ${path}`);
            return path;
        }
        current = current[key];
    }

    if (typeof current !== 'string') {
        console.warn(`Translation value is not a string: ${path}`);
        return path;
    }

    return current;
};

// Provider component
export const TranslationProvider = ({ children }: { children: ReactNode }) => {
    const [language, setLanguage] = useState<Language>('en');
    const [translations, setTranslations] = useState<any>({});
    const [isLoaded, setIsLoaded] = useState<boolean>(false);

    // Initialize translations
    useEffect(() => {
        // Get the initial language (from localStorage if available)
        const getInitialLanguage = (): Language => {
            if (typeof window === 'undefined') return 'en';

            const storedLanguage = localStorage.getItem('language') as Language;
            return (storedLanguage === 'en' || storedLanguage === 'es') ? storedLanguage : 'en';
        };

        const initialLanguage = getInitialLanguage();

        // Set language state
        if (initialLanguage !== language) {
            setLanguage(initialLanguage);
        }

        // Load translations
        const loadTranslations = async () => {
            try {
                // Fetch the translations file
                const response = await fetch(`/locales/${initialLanguage}/common.json`);
                if (!response.ok) {
                    throw new Error(`Failed to load translations: ${response.statusText}`);
                }

                const data = await response.json();
                setTranslations(data);
                setIsLoaded(true);
            } catch (error) {
                console.error('Error loading translations:', error);
                // Fallback to empty object if fetch fails
                setTranslations({});
                setIsLoaded(true);
            }
        };

        loadTranslations();
    }, [language]);

    // Change language
    const changeLanguage = (newLanguage: Language) => {
        if (newLanguage === language) return;

        setLanguage(newLanguage);
        localStorage.setItem('language', newLanguage);

        // Load new translations
        const loadNewTranslations = async () => {
            try {
                const response = await fetch(`/locales/${newLanguage}/common.json`);
                if (!response.ok) {
                    throw new Error(`Failed to load translations: ${response.statusText}`);
                }

                const data = await response.json();
                setTranslations(data);
            } catch (error) {
                console.error(`Error loading ${newLanguage} translations:`, error);
                setTranslations({});
            }
        };

        loadNewTranslations();
    };

    // Translate function
    const t = (key: string, params?: Record<string, string>): string => {
        if (!isLoaded) return key;

        let translation = getNestedTranslation(translations, key);

        // Replace parameters if provided
        if (params) {
            Object.entries(params).forEach(([paramKey, paramValue]) => {
                translation = translation.replace(`{{${paramKey}}}`, paramValue);
            });
        }

        return translation;
    };

    return (
        <TranslationContext.Provider value={{ t, language, changeLanguage, isLoaded }}>
            {children}
        </TranslationContext.Provider>
    );
};

// Hook to use the translation context
export const useTranslation = () => {
    const context = useContext(TranslationContext);

    if (context === undefined) {
        throw new Error('useTranslation must be used within a TranslationProvider');
    }

    return context;
};