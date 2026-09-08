import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

/*  Self-hosted variable fonts. Imported here rather than with @import in CSS
 *  so the bundler resolves them from node_modules, and so the page makes no
 *  third-party request at a competition venue with unreliable Wi-Fi. */
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';

import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
