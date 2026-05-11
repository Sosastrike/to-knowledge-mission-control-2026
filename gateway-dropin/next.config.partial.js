// Patch fragment for the existing Mission Control v2 next.config.js.
// Merge the `rewrites` array below into the existing config's async rewrites()
// (or add the function if it doesn't exist). Do NOT replace the full file.
//
// All deep Gateway links rewrite to /gateway?tab=<tab-id>. GatewayShell reads
// usePathname() first so the URL bar shows the deep-link form; the rewrite
// only matters for direct hits and bookmarks. Rewrites — not redirects —
// so the URL stays exactly /gateway/<segment> (D7).

module.exports = {
  async rewrites() {
    return [
      { source: '/gateway/overview',            destination: '/gateway?tab=overview' },
      { source: '/gateway/agent-hub',           destination: '/gateway?tab=agent-hub' },
      { source: '/gateway/agent-hub/paperclip', destination: '/gateway?tab=paperclip' },
      { source: '/gateway/paperclip',           destination: '/gateway?tab=paperclip' },
      { source: '/gateway/dispatcher',          destination: '/gateway?tab=dispatcher' },
      { source: '/gateway/token-governor',      destination: '/gateway?tab=governor' },
      { source: '/gateway/bridge-session',      destination: '/gateway?tab=bridge' },
      { source: '/gateway/health',              destination: '/gateway?tab=health' },
      { source: '/gateway/routes',              destination: '/gateway?tab=routes' },
      { source: '/gateway/registry',            destination: '/gateway?tab=registry' },
      { source: '/gateway/policies',            destination: '/gateway?tab=policies' },
    ]
  },
}
