import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api-proxy': {
        target: 'https://jawenzysmm.com', // API sağlayıcının domaini
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-proxy/, ''),
        secure: false,
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
