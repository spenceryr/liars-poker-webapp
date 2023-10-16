import { defineConfig } from 'vite';
import svgLoader from 'vite-svg-loader';
import vue from '@vitejs/plugin-vue';
import { resolve, join } from 'node:path';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    svgLoader(),
    cssInjectedByJsPlugin({ relativeCSSInjection: true })
  ],
  resolve: {
    alias: [
      { find: '/@', replacement: resolve(__dirname, 'src') },
      { find: '@', replacement: resolve(__dirname, 'src') },
    ]
  },
  appType: 'mpa',
  base: '/assets/',
  build: {
    minify: false,
    target: 'es2015',
    manifest: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src', 'pages', 'index', 'main.js'),
        lobby: resolve(__dirname, 'src', 'pages', 'lobby', 'main.js'),
        'lobby-list': resolve(__dirname, 'src', 'pages', 'lobby-list', 'main.js')
      },
      output: {
        manualChunks: (id) => {
          if (id.startsWith(resolve(__dirname, 'src', 'assets', 'playing-card-icons'))) {
            return 'playing-card-icons';
          }
        }
      }
    },
  },
})
