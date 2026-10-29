import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind'; // (Hoặc các plugin khác bạn đang dùng)

export default defineConfig({
  integrations: [tailwind()],
  build: {
    format: 'file' // Tắt chế độ tạo thư mục, giảm 50% số lượng file!
  }
});
