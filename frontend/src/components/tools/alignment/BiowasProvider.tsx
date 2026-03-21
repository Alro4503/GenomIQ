'use client';

import { ReactNode } from 'react';
import BiowasInitializer from './BiowasInitializer';

interface BiowasProviderProps {
  children: ReactNode;
}

/**
 * Provider component that initializes Biowasm modules
 * Place this in your layout near the root of your application
 */
const BiowasProvider: React.FC<BiowasProviderProps> = ({ children }) => {
  return (
    <>
      <BiowasInitializer />
      {children}
    </>
  );
};

export default BiowasProvider;