import { useContext } from 'react';
import { ThemeContext } from '@/context/ThemeContext';

/**
 * Hook para acceder al contexto del tema
 * @returns Contexto del tema con estado actual y método para alternar
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme debe ser utilizado dentro de un ThemeProvider');
  }
  
  return context;
};

export default useTheme;