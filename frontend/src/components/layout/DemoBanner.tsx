'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 px-4 py-2.5 text-sm">
      <div className="container mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 pr-8">
        <span className="font-semibold text-amber-800 dark:text-amber-300 shrink-0">
          Portfolio Demo
        </span>
        <span className="text-amber-700 dark:text-amber-400">
          This is a simplified frontend-only version. Auth, persistent history, and WebSocket streaming are disabled.
          AI chat uses Gemini Flash · BLAST, sequences &amp; annotation call external APIs directly.
        </span>
        <Link
          href="https://github.com/AlvaroRodriguezL925/GenomIQ"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 underline text-amber-800 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200"
        >
          View original source →
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss banner"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 p-1"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}
