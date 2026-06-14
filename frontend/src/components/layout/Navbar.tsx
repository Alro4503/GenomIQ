'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/context/TranslationProvider';
import ThemeToggle from './ThemeToggle';
import UserAvatar from './UserAvatar';

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t, language, changeLanguage } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  // Toggle mobile menu
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Toggle language
  const toggleLanguage = () => {
    changeLanguage(language === 'en' ? 'es' : 'en');
  };

  // Renderizar la navegación anidada
  const renderBreadcrumb = () => {
    // Si no está autenticado o está en el inicio, no mostrar breadcrumb
    if (!user) return null;

    // Siempre empezamos con Dashboard
    let breadcrumb = [
      <Link
        key="dashboard"
        href="/dashboard"
        className="text-[#55A63F] font-medium"
      >
        {t('nav.dashboard')}
      </Link>
    ];

    // Si estamos en la página de chat
    if (pathname?.startsWith('/chat')) {
      breadcrumb.push(
        <span key="separator-chat" className="mx-2 text-neutral-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </span>
      );
      breadcrumb.push(
        <span key="chat" className="text-blue-500 font-medium">
          AI Chat
        </span>
      );
    }

    // Si estamos en la página de herramientas
    else if (pathname?.startsWith('/tools')) {
      breadcrumb.push(
        <span key="separator-tools" className="mx-2 text-neutral-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </span>
      );

      // Link para Tools principal (clickable) - Using purple color but dashboard style
      breadcrumb.push(
        <Link
          key="tools"
          href="/tools"
          className="text-purple-500 font-medium"
        >
          {t('nav.tools') || 'Tools'}
        </Link>
      );

      // Si estamos en una herramienta específica (como translation)
      if (pathname !== '/tools') {
        const toolPath = pathname.split('/');
        if (toolPath.length > 2) {
          const toolName = toolPath[2];

          breadcrumb.push(
            <span key="separator-tool-specific" className="mx-2 text-neutral-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </span>
          );

          // Obtener el nombre formateado de la herramienta
          let toolDisplayName = toolName.charAt(0).toUpperCase() + toolName.slice(1);

          // Si disponemos de una traducción, la usamos
          if (t(`tools.${toolName}`)) {
            toolDisplayName = t(`tools.${toolName}`);
          }

          breadcrumb.push(
            <span key={toolName} className="text-purple-600 font-medium">
              {toolDisplayName}
            </span>
          );
        }
      }
    }

    return (
      <div className="flex items-center">
        {breadcrumb}
      </div>
    );
  };

  // Styles for authentication buttons with appropriate color (updated to green)
  const authButtonStyle = (path: string) =>
    `navbar-auth-button uppercase text-sm font-medium border border-[#55A63F] px-4 py-1.5 rounded transition-colors ${pathname === path
      ? 'bg-[#55A63F]/10 text-[#55A63F]'
      : 'text-neutral-700 dark:text-neutral-300 hover:bg-[#55A63F]/10 hover:text-[#55A63F]'
    }`;

  // Logo destination based on authentication status
  const logoDestination = user ? '/dashboard' : '/';

  // Mobile avatar component
  const MobileUserAvatar = () => (
    <button
      onClick={toggleMenu}
      className="flex items-center justify-center w-8 h-8 rounded-full bg-[#55A63F] text-white font-medium"
    >
      {user?.full_name ? user.full_name[0].toUpperCase() : user?.email[0].toUpperCase()}
    </button>
  );

  return (
    <header className="navbar bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
      <div className="container mx-auto px-4 h-16 flex items-center">
        {/* Logo (25% del espacio) */}
        <div className="w-1/4 flex items-center justify-start">
          <Link href={logoDestination} className="genomiq-logo">
            <div 
              className="flex items-center"
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              <div className="relative h-10 w-10 transition-all duration-300">
                <Image
                  src="/logo-genomiq.jpg"
                  alt="G"
                  fill
                  className="object-contain transition-all duration-300"
                />
              </div>
              <div className={`hidden md:block overflow-hidden w-0 transition-all duration-300 ${isHovering ? 'w-28' : ''}`}>
                <div className="flex items-center whitespace-nowrap">
                  <span className="text-neutral-700 dark:text-neutral-300 tracking-tight font-extrabold text-xl">enom</span>
                  <span className="text-[#55A63F] tracking-tight font-extrabold text-xl">IQ</span>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Centered Navigation Links (50% del espacio) */}
        <div className="w-1/2 hidden md:flex justify-center">
          {renderBreadcrumb()}
        </div>

        {/* Right Controls (25% del espacio) */}
        <div className="w-3/4 md:w-1/4 flex items-center justify-end space-x-4">
          {/* Login Button or User Avatar */}
          {/* Demo mode: always show user avatar */}
          <div className="hidden md:block">
            <UserAvatar />
          </div>
          <div className="md:hidden">
            <MobileUserAvatar />
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && user && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 z-10">
          <div className="container mx-auto px-4 py-4 flex flex-col space-y-4">
            {/* User info if logged in (mobile only) */}
            {user && (
              <div className="flex items-center space-x-3 px-2 py-3 border-b border-neutral-200 dark:border-neutral-700">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                    {user.full_name || user.email}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            )}
            
            {/* Direct links for logged in users */}
            <div className="mobile-nav-links space-y-3 mb-2">
              <Link
                href="/dashboard"
                className="block px-2 py-1 rounded text-[#55A63F] hover:bg-[#55A63F]/10"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('nav.dashboard')}
              </Link>

              <Link
                href="/chat"
                className="block px-2 py-1 rounded text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                onClick={() => setIsMenuOpen(false)}
              >
                AI Chat
              </Link>

              {/* Tools parent link */}
              <Link
                href="/tools"
                className="block px-2 py-1 rounded text-purple-500 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('nav.tools') || 'Tools'}
              </Link>
            </div>

            {/* Settings Options for logged in users */}
            <div className="space-y-3 border-t border-neutral-200 dark:border-neutral-700 pt-3">
              {/* Language Toggle */}
              <div className="px-2 py-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t('common.language')}:
                  </span>
                  <select
                    value={language}
                    onChange={(e) => changeLanguage(e.target.value as 'en' | 'es')}
                    className="text-sm rounded-md border-neutral-300 dark:border-neutral-700 
                      bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white 
                      focus:ring-[#55A63F] focus:border-[#55A63F]"
                  >
                    <option value="en">{t('common.languageEn')}</option>
                    <option value="es">{t('common.languageEs')}</option>
                  </select>
                </div>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="flex items-center w-full px-2 py-1 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
              >
                {theme === 'dark' ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                    {t('common.lightMode')}
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                      />
                    </svg>
                    {t('common.darkMode')}
                  </>
                )}
              </button>
            </div>

            {/* Demo mode: no logout */}
            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-3">
              <p className="px-2 text-xs text-neutral-400 dark:text-neutral-500">Portfolio Demo Mode</p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;