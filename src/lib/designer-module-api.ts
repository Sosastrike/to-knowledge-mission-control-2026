import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { requireRole } from '@/lib/auth'

export type CatchAllParams = Promise<{ path?: string[] }>

export const NODE24_BIN = '/home/tony/.nvm/versions/node/v24.14.1/bin'

export function authJson(request: NextRequest, role: 'viewer' | 'operator' | 'admin' = 'viewer') {
  const auth = requireRole(request, role)
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  return null
}

export function backendRequired(extra: Record<string, unknown> = {}, status = 503) {
  return NextResponse.json(
    {
      ok: false,
      backend_required: true,
      execution_enabled: false,
      approval_request_created: false,
      error: 'not_wired_yet',
      designed_payload_accepted: true,
      ...extra,
    },
    { status },
  )
}

export function ownerApprovalRequired(extra: Record<string, unknown> = {}, status = 423) {
  return NextResponse.json(
    {
      ok: false,
      owner_approval_required: true,
      approval_state: 'required',
      http_status_when_blocked: status,
      accepted_for_execution: false,
      execution_enabled: false,
      approval_request_created: false,
      ...extra,
    },
    { status },
  )
}

export function credentialRequired(provider: string, names: string[], extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      ok: false,
      credential_required: true,
      execution_enabled: false,
      approval_request_created: false,
      provider,
      credential_names: names,
      next_action: `Add ${names.join(' or ')} through the approved secret manager.`,
      ...extra,
    },
    { status: 503 },
  )
}

export function hasEnv(name: string): boolean {
  const value = process.env[name]
  return typeof value === 'string' && value.trim().length > 0
}

export function credentialPresence(names: string[]) {
  return Object.fromEntries(names.map((name) => [name, hasEnv(name)]))
}

export async function pathReadable(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK)
    return true
  } catch {
    return false
  }
}

export async function readJsonIfPresent(path: string): Promise<unknown | null> {
  try {
    const text = await readFile(path, 'utf8')
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function safeCommand(command: string): string {
  if (command === 'claude') return join(NODE24_BIN, 'claude')
  return command
}

export async function safeExecFile(
  command: string,
  args: string[] = [],
  timeout = 3000,
): Promise<{ ok: boolean; stdout: string; stderr: string; error?: string }> {
  return new Promise((resolve) => {
    execFile(
      safeCommand(command),
      args,
      {
        timeout,
        env: {
          ...process.env,
          PATH: `${NODE24_BIN}:${process.env.PATH || ''}`,
        },
      },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: String(stdout || ''),
          stderr: String(stderr || ''),
          error: error ? String(error.message || 'command_failed').slice(0, 500) : undefined,
        })
      },
    )
  })
}

export async function pingUrl(url: string, timeout = 2500) {
  const started = Date.now()
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeout),
    })
    return {
      reachable: response.ok,
      status: response.status,
      latency_ms: Date.now() - started,
    }
  } catch (error) {
    return {
      reachable: false,
      latency_ms: Date.now() - started,
      error: error instanceof Error ? error.message.slice(0, 240) : 'request_failed',
    }
  }
}

export function homePath(...parts: string[]) {
  return join(homedir(), ...parts)
}

export function routePath(path?: string[]) {
  return (path || []).map((part) => decodeURIComponent(part)).join('/')
}
