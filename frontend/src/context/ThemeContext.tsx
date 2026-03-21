'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

// Create context
export const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

// Custom hook for using theme
export const useTheme = () => useContext(ThemeContext);

// Theme provider component
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // Track if component is mounted (for hydration)
  const [mounted, setMounted] = useState(false);
  
  // Theme state 
  const [theme, setTheme] = useState<Theme>('light');

  // Toggle theme function
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    
    // Store in localStorage
    localStorage.setItem('theme', newTheme);
    
    // Update data-theme attribute
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // Toggle dark class on html element
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Initialize theme on mount
  useEffect(() => {
    setMounted(true);
    
    // Check localStorage
    const storedTheme = localStorage.getItem('theme') as Theme;
    
    // Check system preference
    const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    
    // Set initial theme
    const initialTheme = storedTheme || systemPreference;
    setTheme(initialTheme);
    
    // Apply theme
    document.documentElement.setAttribute('data-theme', initialTheme);
    
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Avoid hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};