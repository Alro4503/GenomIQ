'use client';

import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

interface ToolPageWrapperProps {
  children: React.ReactNode;
}

/**
 * Wrapper para páginas de herramientas específicas que requieren autenticación
 */
const ToolPageWrapper: React.FC<ToolPageWrapperProps> = ({ children }) => {
  return (
    <ProtectedRoute requireAuth={true} redirectUnauthenticated="/auth/login">
      {children}
    </ProtectedRoute>
  );
};

export default ToolPageWrapper;