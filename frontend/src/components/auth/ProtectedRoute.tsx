'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean; // Si es true, redirige a login cuando no hay usuario autenticado
  redirectAuthenticated?: string; // Ruta a la que redirigir si el usuario está autenticado
  redirectUnauthenticated?: string; // Ruta a la que redirigir si el usuario no está autenticado
}

/**
 * Componente para proteger rutas basado en el estado de autenticación.
 * 
 * Casos de uso:
 * 1. Proteger rutas que requieren autenticación (dashboard, chat, herramientas específicas)
 * 2. Redirigir a usuarios autenticados desde páginas públicas (home, login)
 * 3. Permitir acceso público a ciertas rutas (hub de herramientas)
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = false,
  redirectAuthenticated,
  redirectUnauthenticated = '/auth/login',
}) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Esperar a que se cargue el estado de autenticación
    if (loading) return;
    
    // Si requiere autenticación y no hay usuario, redirigir al login
    if (requireAuth && !user) {
      router.push(redirectUnauthenticated);
      return;
    }
    
    // Si hay un usuario autenticado y se debe redirigir a otra ruta
    if (user && redirectAuthenticated) {
      router.push(redirectAuthenticated);
      return;
    }
  }, [user, loading, requireAuth, redirectAuthenticated, redirectUnauthenticated, router]);

  // Si está cargando, mostrar un spinner
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 rounded-full animate-spin border-2 border-solid border-[#4A9136] border-t-transparent"></div>
      </div>
    );
  }

  // Si requiere autenticación y no hay usuario, no mostrar nada (se redirigirá)
  if (requireAuth && !user) {
    return null;
  }

  // Si hay un usuario autenticado y se debe redirigir, no mostrar nada (se redirigirá)
  if (user && redirectAuthenticated) {
    return null;
  }

  // En cualquier otro caso, mostrar los children
  return <>{children}</>;
};

export default ProtectedRoute;