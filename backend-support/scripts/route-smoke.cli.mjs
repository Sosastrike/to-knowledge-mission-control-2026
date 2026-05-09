#!/usr/bin/env node
// CLI wrapper for the route-smoke helper. Outputs JSON only (no secrets, no raw paths).
// Usage:
//   node backend-support/scripts/route-smoke.cli.mjs --base https://mission-control.example.com [--auth-header-env BEARER_TOKEN]
// The --auth-header-env flag reads a bearer/cookie value from the named env
// var if present; the value never appears in stdout or in the JSON output.

import { runRouteSmoke } from '../dist/route-smoke.js'

function parseArgs(argv) {
  const out = { base: null, authHeaderEnv: null, timeout: 4000 }
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--base') out.base = argv[++i]
    else if (a === '--auth-header-env') out.authHeaderEnv = argv[++i]
    else if (a === '--timeout-ms') out.timeout = Number(argv[++i]) || 4000
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'route-smoke.cli.mjs --base <origin> [--auth-header-env <ENV_NAME>] [--timeout-ms <ms>]\n',
      )
      process.exit(0)
    }
  }
  if (!out.base) {
    process.stderr.write('error: --base <origin> is required\n')
    process.exit(2)
  }
  return out
}

const args = parseArgs(process.argv)
const authValue = args.authHeaderEnv ? process.env[args.authHeaderEnv] : null

const report = await runRouteSmoke({
  baseOrigin: args.base,
  authHeader: authValue ? `Bearer ${authValue}` : null,
  timeoutMs: args.timeout,
})

process.stdout.write(JSON.stringify(report, null, 2) + '\n')
