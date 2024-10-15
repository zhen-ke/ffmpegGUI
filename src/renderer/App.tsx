import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home';

import './App.css';

export default function App() {
  return (
    <div className="app">
      <div className="drag-handle"></div>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </Router>
    </div>
  );
}
