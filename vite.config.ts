import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/*.tmpdir/**', '**/*.tmp']
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
