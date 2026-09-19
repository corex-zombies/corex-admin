import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// FiveM NUI loads via nui://corex-admin/web/index.html — every asset URL must be
// relative ("./assets/...") so the cfx resource scheme resolves them correctly.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    outDir: '../web',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2020',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash:8][extname]',
        chunkFileNames: 'assets/[name]-[hash:8].js',
        entryFileNames: 'assets/[name]-[hash:8].js',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
})
