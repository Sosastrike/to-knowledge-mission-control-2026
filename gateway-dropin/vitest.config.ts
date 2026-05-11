import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
  },
  resolve: {
    alias: {
      '@/components/gateway/GatewayShell': new URL(
        './src/components/gateway/GatewayShell',
        import.meta.url,
      ).pathname,
    },
  },
})
