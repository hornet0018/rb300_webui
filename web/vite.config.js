import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        debug: resolve(__dirname, 'debug.html'),
      },
      external: ['roslib'],
      output: {
        globals: {
          roslib: 'ROSLIB',
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
})
