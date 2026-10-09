import React from 'react';
import { createRoot } from 'react-dom/client';
// headings are set in Fraunces, with its optical sizes: a little sharper as they get bigger
import '@fontsource-variable/fraunces/opsz.css';
// text and figures are set in IBM Plex Sans, as on the vault
import '@fontsource-variable/ibm-plex-sans';
import './styles.css';
import App from './App';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
