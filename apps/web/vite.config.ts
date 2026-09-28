import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Single .env at the repo root, shared with the server.
  envDir: '../../',
  server: {
    // Expose on the LAN so phones on the same Wi-Fi can open the controller in development.
    host: true,
    port: 5173,
    strictPort: true,
  },
});
