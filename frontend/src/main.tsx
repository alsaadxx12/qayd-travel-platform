import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mantineTheme } from './theme/designSystem';
import './index.css';
import App from './App';

import 'dayjs/locale/ar';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
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
