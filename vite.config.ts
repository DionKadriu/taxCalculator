import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/taxCalculator/',
  server: { port: 5173, open: true },
});
