import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mantineTheme } from './theme/designSystem';
import './index.css';
import App from './App';

import 'dayjs/locale/ar';

// Safely handle Vite Chunk Preload Errors after new deployments without entering infinite reload loop
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite preload error detected:', event);
  const now = Date.now();
  const lastReload = Number(sessionStorage.getItem('last_chunk_reload_ts') || '0');
  if (now - lastReload > 30000) {
    sessionStorage.setItem('last_chunk_reload_ts', String(now));
    window.location.reload();
  }
});

window.addEventListener('error', (e) => {
  const msg = e.message || '';
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Expected a JavaScript-or-Wasm module script') ||
    msg.includes('error loading dynamically imported module')
  ) {
    const now = Date.now();
    const lastReload = Number(sessionStorage.getItem('last_chunk_reload_ts') || '0');
    if (now - lastReload > 30000) {
      sessionStorage.setItem('last_chunk_reload_ts', String(now));
      console.warn('Dynamic import chunk error detected, reloading once...', msg);
      window.location.reload();
    }
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 0,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={mantineTheme} defaultColorScheme="light">
        <Notifications position="top-right" zIndex={9999} autoClose={3500} limit={3} containerWidth={380} />
        <App />
      </MantineProvider>
    </QueryClientProvider>
  </StrictMode>,
);
