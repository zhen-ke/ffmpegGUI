import { LanguageProvider } from './LanguageContext';
import Home from './Home';

import './App.css';

function App() {
  return (
    <LanguageProvider>
      <div className="app">
        <div className="drag-handle"></div>
        <Home />
      </div>
    </LanguageProvider>
  );
}

export default App;
