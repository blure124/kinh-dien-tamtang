import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()],
  build: {
    concurrency: 1 // Render trang tĩnh tuần tự để bảo vệ file descriptors
  },
  vite: {
    build: {
      rollupOptions: {
        maxParallelFileOps: 20
      }
    }
  }
});
