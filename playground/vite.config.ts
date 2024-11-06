import fs from 'node:fs'
import { defineConfig } from 'vite'

export default defineConfig({
  // optimizeDeps: {
  //   exclude: ['../dist'],
  // },
  server: {
    fs: {
      allow: ['../'],
    },
  },
})
