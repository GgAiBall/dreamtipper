import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// 部署到 GitHub Pages 时设置为你的仓库名（不带斜杠），如 'dreamtipper'
// 本地开发设为 '/'
const BASE = process.env.VITE_BASE_URL || '/'

export default defineConfig({
  base: BASE,
  plugins: [vue()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
