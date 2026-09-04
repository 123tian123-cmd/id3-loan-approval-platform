import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf('node_modules') !== -1) {
            if (id.indexOf('react') !== -1) return 'react'
            if (id.indexOf('lucide') !== -1) return 'lucide'
          }
        },
      },
    },
  },
})
