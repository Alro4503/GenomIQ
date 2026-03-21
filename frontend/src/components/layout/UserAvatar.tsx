'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/context/TranslationProvider';
import LanguageSwitcher from './LanguageSwitcher';

const UserAvatar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Get first letter of user's full name, or fallback to email
  const getInitial = (): string => {
    if (!user) return '';
    
    if (user.full_name && user.full_name.trim().length > 0) {
      return user.full_name.trim()[0].toUpperCase();
    }
    
    return user.email[0].toUpperCase();
  };
  
  // Toggle dropdown menu
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  if (!user) return null;
  
  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar Circle */}
      <button
        onClick={toggleMenu}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-[#55A63F] text-white font-medium cursor-pointer hover:bg-[#4A9136] transition-colors"
        aria-label={t('common.userMenu')}
      >
        {getInitial()}
      </button>
      
      {/* Dropdown Menu */}
      {isMenuOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 z-20">
          <div className="p-2">
            {/* User Info */}
            <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-700">
              <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                {user.full_name || user.email}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {user.email}
              </p>
            </div>
            
            {/* Settings Options */}
            <div className="px-2 py-2 space-y-1">
              {/* Language Switcher */}
              <div className="px-2 py-2">
                <LanguageSwitcher />
              </div>
              
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="flex items-center w-full px-2 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md transition-colors"
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
            
            {/* Logout Option */}
            <div className="px-2 py-2 border-t border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => {
                  logout();
                  setIsMenuOpen(false);
                }}
                className="flex items-center w-full px-2 py-2 text-sm text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAvatar;