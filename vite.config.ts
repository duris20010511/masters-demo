import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  // vitest
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '**/.worktrees/**', '**/dist/**'],
  },
} as never)
