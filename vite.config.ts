import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  // vitest
  test: { environment: 'jsdom' },
} as never)
