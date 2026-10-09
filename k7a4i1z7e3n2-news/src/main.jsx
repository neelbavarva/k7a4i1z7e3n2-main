import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
// headings are set in Fraunces, with its optical sizes: a little sharper as they get bigger
import '@fontsource-variable/fraunces/opsz.css';
// text and figures are set in IBM Plex Sans, as on the vault
import '@fontsource-variable/ibm-plex-sans';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
