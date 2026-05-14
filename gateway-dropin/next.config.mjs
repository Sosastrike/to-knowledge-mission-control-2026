const gatewayRewrites = [
  { source: '/gateway/tools', destination: '/gateway?control=tools' },
  { source: '/gateway/brain', destination: '/gateway?control=brain' },
  { source: '/gateway/agent-hub/agent-zero/config', destination: '/gateway?control=agent-zero-config' },
  { source: '/gateway/agent-hub/agent-zero/chat', destination: '/gateway?control=agent-zero-chat' },
  { source: '/gateway/agent-hub/hermes/config', destination: '/gateway?control=hermes-config' },
  { source: '/gateway/agent-hub/hermes/chat', destination: '/gateway?control=hermes-chat' },
  { source: '/gateway/agent-hub/pi/config', destination: '/gateway?control=pi-config' },
  { source: '/gateway/agent-hub/pi/recommend', destination: '/gateway?control=pi-recommend' },
  { source: '/gateway/agent-hub/spaceagent/config', destination: '/gateway?control=spaceagent-config' },
  { source: '/gateway/agent-hub/spaceagent/research', destination: '/gateway?control=spaceagent-research' },
  { source: '/gateway/agent-hub/paperclip/config', destination: '/gateway?control=paperclip-config' },
  { source: '/gateway/agent-hub/openclaw/config', destination: '/gateway?control=openclaw-config' },
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
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return gatewayRewrites
  },
}

export default nextConfig
