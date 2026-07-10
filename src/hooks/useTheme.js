import { useState, useEffect } from 'react';

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('lc-theme') === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('lc-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
      localStorage.setItem('lc-theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    const saved = localStorage.getItem('lc-theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      setIsDark(true);
    }
  }, []);

  return { isDark, toggleTheme: () => setIsDark(d => !d) };
}
