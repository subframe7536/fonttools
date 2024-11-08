import { fonttools } from '@subframe7536/fontools/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // @ts-expect-error types
  plugins: [fonttools()],
  build: {
    minify: false,
  },
  server: {
    fs: {
      allow: ['../'],
    },
  },
})
