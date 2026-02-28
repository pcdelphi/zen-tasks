import { defineConfig } from 'vite';

// GitHub Pages 部署时，base 需要设置为仓库名
// 例如：https://username.github.io/repo-name/ 则 base 为 '/repo-name/'
// 如果部署到根域名，则 base 为 '/'
const base = process.env.GITHUB_PAGES ? '/zen-tasks/' : '/';

export default defineConfig({
  base,
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
