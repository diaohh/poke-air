// Self-hosted fonts (no Google Fonts requests at runtime): Lilita One for display, Rubik for UI.
import '@fontsource/lilita-one/400.css';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/700.css';
import '@fontsource/rubik/800.css';
import '@fontsource/rubik/900.css';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { HomeScreen } from './home/HomeScreen';
import './i18n';
import './index.css'; // Tailwind + tokens; declares the cascade layers used by main.scss.
import { warmUpBackend } from './lib/backend';
import './styles/main.scss';

// A sleeping free backend starts waking while the page and its chunks load (decision D-66).
warmUpBackend();

// Each face is its own chunk: phones never download the Host screen (QR, and later the battle scene).
const HostScreen = lazy(() => import('./host/HostScreen').then((m) => ({ default: m.HostScreen })));
const ControllerScreen = lazy(() =>
  import('./controller/ControllerScreen').then((m) => ({ default: m.ControllerScreen })),
);

const TeamsScreen = lazy(() =>
  import('./teams/TeamsScreen').then((m) => ({ default: m.TeamsScreen })),
);

const router = createBrowserRouter([
  { path: '/', element: <HomeScreen /> },
  { path: '/host', element: <HostScreen /> },
  { path: '/j/:code', element: <ControllerScreen /> },
  { path: '/teams', element: <TeamsScreen /> },
  { path: '*', element: <HomeScreen /> },
]);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <Suspense fallback={null}>
      <RouterProvider router={router} />
    </Suspense>
  </StrictMode>,
);
