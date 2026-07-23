import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {applyTheme, loadStoredTheme} from './utils/theme';

// Apply any previously saved theme before first paint to avoid a flash of
// the wrong theme on reload.
applyTheme(loadStoredTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
