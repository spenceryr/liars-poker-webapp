import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, join } from 'node:path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  resolve: {
    alias: [
      { find: '/@', replacement: resolve(__dirname, 'src') }
    ]
  },
  appType: 'mpa',
  build: {
    target: 'es2015',
    manifest: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src', 'pages', 'index', 'main.js'),
        'lobby': resolve(__dirname, 'src', 'pages', 'lobby', 'main.js'),
        'lobby-list': resolve(__dirname, 'src', 'pages', 'lobby-list', 'main.js')
      }
    }
  }
})
