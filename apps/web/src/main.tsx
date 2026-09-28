import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { HomeScreen } from './home/HomeScreen';
import './i18n';
import './index.css';

// Each face is its own chunk: phones never download the Host screen (QR, and later the battle scene).
const HostScreen = lazy(() => import('./host/HostScreen').then((m) => ({ default: m.HostScreen })));
const ControllerScreen = lazy(() =>
  import('./controller/ControllerScreen').then((m) => ({ default: m.ControllerScreen })),
);

const router = createBrowserRouter([
  { path: '/', element: <HomeScreen /> },
  { path: '/host', element: <HostScreen /> },
  { path: '/j/:code', element: <ControllerScreen /> },
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
