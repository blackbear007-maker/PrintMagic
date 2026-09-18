import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    // CloudClient 走同源 /api；開發時轉給本機後端 (npm run server, port 3001)
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    assetsInlineLimit: 4096
  },
  worker: {
    format: 'es'
  }
});
