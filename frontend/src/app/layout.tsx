'use client';

import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/layout/Navbar';
import DemoBanner from '@/components/layout/DemoBanner';
import Footer from '@/components/layout/Footer';
import LoadingScreen from '@/components/layout/LoadingScreen';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { TranslationProvider } from '@/context/TranslationProvider';
import { ChatProvider } from '@/context/ChatContext';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Head from 'next/head';

// Font definitions
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Handle client-side rendering for theme
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  
  // Check if we're on the home page
  const isHomePage = pathname === '/' || pathname === '';

  useEffect(() => {
    setMounted(true);
    
    // Simulate a minimum loading time to ensure translations are ready
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    
    // Asegurar que el título siempre sea "GenomIQ"
    document.title = "GenomIQ";
    
    return () => clearTimeout(timer);
  }, []);

  // Efecto adicional para mantener el título constante en cambios de ruta
  useEffect(() => {
    // Restablecer el título en cada cambio de ruta
    document.title = "GenomIQ";
  }, [pathname]);

  if (!mounted) {
    return (
      <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
        <body className={`${inter.className} min-h-screen bg-white dark:bg-neutral-900`}>
          <div className="flex items-center justify-center min-h-screen">
            <div className="w-12 h-12 rounded-full animate-spin border-2 border-solid border-[#4A9136] border-t-transparent"></div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <title>GenomIQ</title>
        <meta name="description" content="Modern bioinformatics platform with AI assistance" />
      </head>
      <body className={`${inter.className} min-h-screen bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100`}>
        <ThemeProvider>
          <AuthProvider>
            <TranslationProvider>
              <ChatProvider>
                {loading ? (
                  <LoadingScreen />
                ) : (
                  <div className="flex flex-col min-h-screen">
                    <DemoBanner />
                    <Navbar />
                    <main className="flex-grow">
                      {children}
                    </main>
                    {isHomePage && <Footer />}
                  </div>
                )}
              </ChatProvider>
            </TranslationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}