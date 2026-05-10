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
  
  // Security headers
  // Content-Security-Policy is set in src/proxy.ts with a per-request nonce.
  async redirects() {
    return [
      { source: '/gateway/agent-hub/paperclip', destination: '/gateway?tab=paperclip', permanent: false },
      { source: '/gateway/agent-hub/:id', destination: '/gateway?tab=agent-hub', permanent: false },
      { source: '/gateway/agent-hub', destination: '/gateway?tab=agent-hub', permanent: false },
      { source: '/gateway/routes', destination: '/gateway?tab=routes', permanent: false },
      { source: '/gateway/registry', destination: '/gateway?tab=registry', permanent: false },
      { source: '/gateway/policies', destination: '/gateway?tab=policies', permanent: false },
      { source: '/gateway/health', destination: '/gateway?tab=health', permanent: false },
      { source: '/gateway/dispatcher', destination: '/gateway?tab=dispatcher', permanent: false },
      { source: '/gateway/token-governor', destination: '/gateway?tab=governor', permanent: false },
      { source: '/gateway/bridge-session', destination: '/gateway?tab=bridge', permanent: false },
      { source: '/gateway/node-detail', destination: '/gateway?tab=node-detail', permanent: false },
      { source: '/gateway/mobile-tablet', destination: '/gateway?tab=mobile', permanent: false },
    ];
  },

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
    ];
  },
  
};

module.exports = withNextIntl(nextConfig);
