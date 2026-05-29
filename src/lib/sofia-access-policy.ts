import { NextRequest, NextResponse } from 'next/server'

import { requireRole, type User, userHasAnyAgentScope } from '@/lib/auth'
import { SOFIA_DEPUTY_IDENTITY } from '@/lib/sofia-identity'

export const SOFIA_AGENT_ALIASES = [
  'sofia',
  'sofia-deputy',
  'sofia-deputy-dispatcher',
  'deputy-nuclear-dispatcher',
]

export const SOFIA_READ_SCOPES = [
  'sofia.read',
  'sofia.gateway_read',
  'sofia.ron_review_read',
  'sofia.cybersecurity_review_read',
]

export const SOFIA_DRAFT_SCOPES = [
  'sofia.recommend',
  'sofia.draft',
  'sofia.ron_review_request',
]

export const SOFIA_TASK_WRITE_SCOPES = [
  'sofia.task_event_write',
]

export const SOFIA_CONCURRENCE_SCOPES = [
  'sofia.jarvis_concurrence_request',
]

type SofiaRouteAuth =
  | { ok: true; user: User; token_source: 'human_session_or_global_admin' | 'agent_scoped_token'; master_api_key_used: boolean }
  | { ok: false; response: NextResponse }

function normalized(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase().replace(/[@]/g, '').replace(/[_\s]+/g, '-')
}

export function isSofiaAgentName(value: string | null | undefined) {
  return SOFIA_AGENT_ALIASES.includes(normalized(value))
}

function isAgentScopedUser(user: User) {
  return Boolean(user.agent_scopes?.length) || user.username.startsWith('agent:')
}

export function requireSofiaRouteAuth(
  request: NextRequest,
  options: {
    minimum_human_role?: User['role']
    agent_scopes: string[]
  },
): SofiaRouteAuth {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }),
    }
  }

  const user = auth.user
  const minimumHumanRole = options.minimum_human_role || 'viewer'
  const roleCheck = requireRole(request, minimumHumanRole)
  const humanAllowed = !isAgentScopedUser(user) && !('error' in roleCheck)
  const scopedAgentAllowed = isSofiaAgentName(user.agent_name || user.display_name || user.username)
    && userHasAnyAgentScope(user, options.agent_scopes)

  if (humanAllowed || scopedAgentAllowed) {
    return {
      ok: true,
      user,
      token_source: isAgentScopedUser(user) ? 'agent_scoped_token' : 'human_session_or_global_admin',
      master_api_key_used: user.username === 'api',
    }
  }

  return {
    ok: false,
    response: NextResponse.json({
      ok: false,
      error: 'sofia_scope_required',
      agent_id: SOFIA_DEPUTY_IDENTITY.agent_id,
      display_name: SOFIA_DEPUTY_IDENTITY.display_name,
      required_scopes: options.agent_scopes,
      reports_to: SOFIA_DEPUTY_IDENTITY.reports_to,
      final_authority: SOFIA_DEPUTY_IDENTITY.final_authority,
      opencloud_intermediary: false,
      credential_values_exposed: false,
    }, { status: 403 }),
  }
}
