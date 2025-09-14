import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: 'apps/web',
  plugins: [react()],
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'packages/core/src'),
      '@cpu': path.resolve(__dirname, 'packages/cpu/src'),
      '@gpu': path.resolve(__dirname, 'packages/gpu/src'),
      '@worker': path.resolve(__dirname, 'packages/worker/src'),
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    open: false
  }
});
