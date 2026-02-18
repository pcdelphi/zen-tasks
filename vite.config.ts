import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5000,
    host: '0.0.0.0',
    allowedHosts: ['.bytedance.net', '.coze-coding.bytedance.net'],
    hmr: {
      overlay: true,
      path: '/hot/vite-hmr',
      port: 6000,
      clientPort: 443,
      timeout: 30000,
    },
  },
  preview: {
    port: 5000,
    host: '0.0.0.0',
    allowedHosts: ['.bytedance.net', '.coze-coding.bytedance.net'],
  },
});
