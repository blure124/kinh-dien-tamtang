import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()],
  vite: {
    build: {
      rollupOptions: {
        maxParallelFileOps: 50 // Khống chế số file mở đồng thời để không bị vượt ngưỡng EMFILE
      }
    }
  }
});
