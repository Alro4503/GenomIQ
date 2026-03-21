import { useContext } from 'react';
import { AuthContext } from '@/context/AuthContext';

/**
 * Hook para acceder al contexto de autenticación
 * @returns Contexto de autenticación con usuario, estado y métodos
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  
  return context;
};

export default useAuth;