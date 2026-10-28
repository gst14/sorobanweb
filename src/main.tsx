import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/App.tsx';
import { createAppServices } from './app/composition.ts';
import { ServicesProvider } from './presentation/ServicesProvider.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el elemento #root');

createRoot(root).render(
  <StrictMode>
    <ServicesProvider services={createAppServices()}>
      <App />
    </ServicesProvider>
  </StrictMode>,
);
