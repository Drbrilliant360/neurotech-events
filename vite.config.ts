/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Tests run the app in live mode against the in-memory fake API in src/test/fakeApi.ts.
    env: { VITE_API_BASE_URL: 'http://api.test' },
    restoreMocks: true,
  },
})
