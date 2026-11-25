import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // permite acessar pelo IP da máquina na rede da empresa
    proxy: {
      '/api': API,
      '/uploads': API,
      '/socket.io': { target: API, ws: true },
    },
  },
});
