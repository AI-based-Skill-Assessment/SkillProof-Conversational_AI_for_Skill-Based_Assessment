import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ThemeProvider } from './core/theme';
import { AuthProvider } from './core/auth/AuthContext';
import { ToastProvider } from './components/common/Toast';
import { installMediaRegistry } from './utils/mediaRegistry';
import { installResponsiveTables } from './utils/responsiveTables';

// Track every camera/mic stream so none can be left running (see mediaRegistry.js)
installMediaRegistry();
// On phones, show every table as stacked cards (see responsiveTables.js)
installResponsiveTables();

// Shared component + page stylesheets, loaded globally. Pages are lazy-loaded
// (see App.jsx), but many pages use these class names directly, so they must
// not depend on some other page having been opened first. Imported before the
// core theme files, in the same order as before code-splitting, so the
// cascade (which rule wins) is unchanged.
import './styles/common/animated-theme-toggler.css';
import './styles/pages/public.css';
import './styles/common/sidebar.css';
import './styles/common/topbar.css';
import './styles/common/status-badge.css';
import './styles/common/loaders.css';
import './styles/pages/portal.css';
import './styles/common/button.css';
import './styles/common/toast.css';
import './styles/common/input.css';
import './styles/common/google-button.css';
import './styles/pages/biometrics-premium.css';
import './styles/common/primitives.css';
import './styles/common/modal.css';
import './styles/common/card.css';

import './core/theme.css';
import './core/variables.css';
import './core/global.css';
import './core/animations.css';
import './core/responsive.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
