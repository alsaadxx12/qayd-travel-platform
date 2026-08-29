import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mantineTheme } from './theme/designSystem';
import './index.css';
import App from './App';

import 'dayjs/locale/ar';

// Auto-reload on Vite Chunk Preload Errors after new deployments
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite preload error detected, reloading page for new deployment...', event);
  window.location.reload();
});

window.addEventListener('error', (e) => {
  const msg = e.message || '';
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Expected a JavaScript-or-Wasm module script')
  ) {
    if (!sessionStorage.getItem('chunk_reload_lock')) {
      sessionStorage.setItem('chunk_reload_lock', '1');
      console.warn('Dynamic import chunk error detected, reloading...', msg);
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
