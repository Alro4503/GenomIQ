import { useEffect, useState } from 'react';

// Tipos de idiomas soportados
export type Language = 'en' | 'es';

// Interfaz de traducciones
export interface Translations {
  [key: string]: string | Translations;
}

// Cargar traducciones
const loadTranslations = async (language: Language): Promise<Translations> => {
  try {
    // Importamos dinámicamente el archivo JSON de traducciones
    const translations = await import(`@/locales/${language}.json`);
    return translations.default;
  } catch (error) {
    console.error(`Error cargando traducciones para ${language}:`, error);
    // Fallback a inglés si fallan las traducciones
    if (language !== 'en') {
      return loadTranslations('en');
    }
    return {};
  }
};

// Obtener valor anidado en objetos de traducción
const getNestedTranslation = (obj: Translations, path: string): string => {
  const keys = path.split('.');
  let current: any = obj;

  for (const key of keys) {
    if (current[key] === undefined) {
      console.warn(`Clave de traducción no encontrada: ${path}`);
      return path; // Devolvemos la clave si no se encuentra traducción
    }
    current = current[key];
  }

  if (typeof current !== 'string') {
    console.warn(`El valor de traducción no es una cadena: ${path}`);
    return path;
  }

  return current;
};

// Hook de traducción
export const useTranslation = () => {
  const [language, setLanguage] = useState<Language>('en');
  const [translations, setTranslations] = useState<Translations>({});
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Inicializar traducciones
  useEffect(() => {
    // Verificar si hay preferencia guardada en localStorage
    const storedLanguage = localStorage.getItem('language') as Language;
    const initialLanguage = storedLanguage || language;

    if (storedLanguage && storedLanguage !== language) {
      setLanguage(storedLanguage);
    }

    // Cargar traducciones
    loadTranslations(initialLanguage).then((loadedTranslations) => {
      setTranslations(loadedTranslations);
      setIsLoaded(true);
    });
  }, [language]);

  // Cambiar idioma
  const changeLanguage = (newLanguage: Language) => {
    setLanguage(newLanguage);
    localStorage.setItem('language', newLanguage);
    
    // Cargar nuevas traducciones
    loadTranslations(newLanguage).then((loadedTranslations) => {
      setTranslations(loadedTranslations);
    });
  };

  // Función de traducción
  const t = (key: string, params?: Record<string, string>): string => {
    if (!isLoaded) return key;

    let translation = getNestedTranslation(translations, key);

    // Reemplazar parámetros si se proporcionan
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        translation = translation.replace(`{{${paramKey}}}`, paramValue);
      });
    }

    return translation;
  };

  return { t, language, changeLanguage, isLoaded };
};

export default useTranslation;