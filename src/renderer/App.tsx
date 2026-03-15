import { LanguageProvider } from './LanguageContext';
import Home from './Home';
import { useEffect } from 'react';

import './App.css';

function App() {
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    handleChange(mediaQuery);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <LanguageProvider>
      <div className="app">
        <div className="drag-handle" />
        <Home />
      </div>
    </LanguageProvider>
  );
}

export default App;
