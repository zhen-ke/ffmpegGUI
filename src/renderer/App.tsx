import { LanguageProvider } from './LanguageContext';
import Home from './Home';

import './App.css';

function App() {
  return (
    <LanguageProvider>
      <div className="app bg-white dark:bg-gray-900">
        <div className="drag-handle" />
        <Home />
      </div>
    </LanguageProvider>
  );
}

export default App;
