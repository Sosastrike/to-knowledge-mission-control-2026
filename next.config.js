const withNextIntl = require('next-intl/plugin')('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  outputFileTracingExcludes: {
    '/*': ['./.data/**/*'],
  },
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ['100.116.35.95', '76.13.126.188', 'knowledge-vs-ai.com', 'tkmc.knowledge-vs-ai.com', 'mc.knowledge-vs-ai.com'],
  // Transpile ESM-only packages so they resolve correctly in all environments
  transpilePackages: ['react-markdown', 'remark-gfm'],

  async rewrites() {
    return [
      { source: '/gateway/overview', destination: '/gateway?tab=overview' },
      { source: '/gateway/agent-hub', destination: '/gateway?tab=agent-hub' },
      { source: '/gateway/agent-hub/paperclip', destination: '/gateway?tab=paperclip' },
      { source: '/gateway/paperclip', destination: '/gateway?tab=paperclip' },
      { source: '/gateway/dispatcher', destination: '/gateway?tab=dispatcher' },
      { source: '/gateway/token-governor', destination: '/gateway?tab=governor' },
      { source: '/gateway/bridge-session', destination: '/gateway?tab=bridge' },
      { source: '/gateway/health', destination: '/gateway?tab=health' },
      { source: '/gateway/routes', destination: '/gateway?tab=routes' },
      { source: '/gateway/registry', destination: '/gateway?tab=registry' },
      { source: '/gateway/policies', destination: '/gateway?tab=policies' },
    ];
  },

  // Security headers
  // Content-Security-Policy is set in src/proxy.ts with a per-request nonce.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(process.env.NODE_ENV === 'production' && process.env.MC_DISABLE_HSTS !== '1' || process.env.MC_ENABLE_HSTS === '1' ? [
            { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }
          ] : []),
        ],
      },
      {
        source: '/design/gateway/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  
};

module.exports = withNextIntl(nextConfig);
