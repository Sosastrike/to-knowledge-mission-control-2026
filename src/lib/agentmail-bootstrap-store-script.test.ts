import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()
const scriptPath = path.join(repoRoot, 'scripts/agentmail/store-bootstrap-key.mjs')
const packageJsonPath = path.join(repoRoot, 'package.json')

describe('AgentMail bootstrap key store script', () => {
  it('is registered as an owner-only hidden prompt command', async () => {
    const script = await import(pathToFileURL(scriptPath).href)
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const source = fs.readFileSync(scriptPath, 'utf8')

    expect(packageJson.scripts['agentmail:store-bootstrap-key']).toBe('node scripts/agentmail/store-bootstrap-key.mjs')
    expect(script.normalizeRef('env:AGENTMAIL_API_KEY')).toBe('AGENTMAIL_API_KEY')
    expect(script.normalizeRef(' AGENTMAIL_API_KEY\r\n')).toBe('AGENTMAIL_API_KEY')
    expect(script.maskAgentMailBootstrapKey('agentmail-test-secret-value-1234567890')).toBe('am_****7890')
    expect(script.fingerprintSecret('agentmail-test-secret-value-1234567890')).toHaveLength(12)
    expect(script.rejectsRawSecretArgument(['--key=agentmail-test-secret-value-1234567890'])).toBe(true)
    expect(script.rejectsRawSecretArgument(['--token=agentmail-test-secret-value-1234567890'])).toBe(true)

    const summary = script.buildSanitizedStoreSummary({
      ok: true,
      providerVaultRowCreated: true,
      maskedPreview: 'am_****7890',
      fingerprint: 'abc123def456',
      keyLength: 36,
      refName: 'AGENTMAIL_API_KEY',
    })
    expect(summary).toMatchObject({
      ok: true,
      source: 'agentmail_bootstrap_key_store',
      provider_id: 'agentmail',
      env_var_name: 'AGENTMAIL_API_KEY',
      provider_vault_row_created: true,
      service_reference_name: 'AGENTMAIL_API_KEY_REF',
      service_reference_value: 'AGENTMAIL_API_KEY',
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
    })
    expect(JSON.stringify(summary)).not.toContain('agentmail-test-secret-value')

    expect(source).toContain('Mission Control AgentMail Bootstrap Credential Store')
    expect(source).toContain('stty')
    expect(source).toContain('-echo')
    expect(source).toContain('provider_id = \'agentmail\'')
    expect(source).toContain('AGENTMAIL_API_KEY_REF')
    expect(source).not.toContain(['AGENTMAIL_API_KEY', '='].join(''))
  })

  it('fails closed without an interactive TTY and does not ask for chat-pasted secrets', () => {
    const output = execFileSync('node', [scriptPath], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        MISSION_CONTROL_SECRETS_MASTER_KEY: Buffer.alloc(32, 9).toString('base64'),
      },
    })

    const parsed = JSON.parse(output)
    expect(parsed).toMatchObject({
      ok: false,
      source: 'agentmail_bootstrap_key_store',
      exact_blocker: 'approved_secret_intake_required',
      credential_values_exposed: false,
      tokens_exposed: false,
      env_values_exposed: false,
    })
  })

  it('rejects command-line raw key input without echoing the key', () => {
    const fakeRawKey = 'agentmail-test-secret-value-1234567890'
    const result = spawnSync('node', [scriptPath, `--key=${fakeRawKey}`], {
      cwd: repoRoot,
      encoding: 'utf8',
    })

    const output = `${result.stdout}${result.stderr}`
    const parsed = JSON.parse(result.stdout)
    expect(parsed).toMatchObject({
      ok: false,
      source: 'agentmail_bootstrap_key_store',
      exact_blocker: 'raw_secret_cli_argument_rejected',
      credential_values_exposed: false,
    })
    expect(output).not.toContain(fakeRawKey)
  })
})
