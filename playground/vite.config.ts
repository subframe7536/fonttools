import fs from 'node:fs'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    fs: {
      allow: ['../'],
    },
  },
})
