#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const NODE = process.execPath
const SCRIPT = 'scripts/check-protected-file-invariants.mjs'

function runFixture(name, fixture, expectedOk, expectedProtection = '') {
  let ok = true
  let output = ''
  try {
    output = execFileSync(NODE, [SCRIPT], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PROTECTED_FILE_INVARIANTS_STATUS_FIXTURE: fixture,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    ok = false
    output = `${error.stdout || ''}${error.stderr || ''}`
  }

  if (ok !== expectedOk) {
    throw new Error(`${name}: expected ok=${expectedOk}, got ok=${ok}\n${output}`)
  }

  if (expectedProtection && !output.includes(expectedProtection)) {
    throw new Error(`${name}: expected protection ${expectedProtection}\n${output}`)
  }
}

runFixture('allows_report_reference', ' M runtime/day-39-memory-governance-guardrails.md\n', true)
runFixture('allows_memory_source_code', ' M src/lib/memory-utils.ts\n', true)
runFixture('blocks_active_agent_memory_file', ' M agents/agent-zero/WORKING.md\n', false, 'active_memory_file')
runFixture('blocks_root_memory_file', ' M MEMORY.md\n', false, 'active_memory_file')
runFixture('blocks_runtime_memory_store', '?? agent-memory/session.md\n', false, 'active_memory_store')
runFixture('blocks_governance_directory', ' M governance/commander.yml\n', false, 'governance_file')
runFixture('blocks_tony_identity_memory_store', ' M tony-memory/session.md\n', false, 'legacy_tony_identity_store')

console.log(JSON.stringify({
  ok: true,
  checked_fixtures: 7,
}, null, 2))
