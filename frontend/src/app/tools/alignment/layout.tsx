'use client';

import { ReactNode } from 'react';
import BiowasInitializer from '@/components/tools/alignment/BiowasInitializer';

export default function AlignmentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BiowasInitializer />
      {children}
    </>
  );
}