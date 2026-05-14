import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'

type PaperclipCompany = {
  name: string
  issue_prefix: string
  access: 'owner_accessible' | 'legacy_membership_warning'
  active_user_members: number
  agents: number
  issues: number
  blocker?: string
}

type PaperclipSnapshot = {
  companies: PaperclipCompany[]
  agents: Array<Record<string, unknown>>
  issues: Array<Record<string, unknown>>
  source: 'paperclip_db_readonly' | 'static_owner_observation'
  read_error?: string
}

const PAPERCLIP_ROOT = '/home/tony/paperclip-lab/paperclip'
const PAPERCLIP_BASE_URL = 'http://100.116.35.95:3100'
const PAPERCLIP_OWNER_PREFIX = 'ECO'

const FALLBACK_SNAPSHOT: PaperclipSnapshot = {
  source: 'static_owner_observation',
  companies: [
    {
      name: 'E copier Solutions',
      issue_prefix: 'ECO',
      access: 'owner_accessible',
      active_user_members: 3,
      agents: 2,
      issues: 6,
    },
    {
      name: 'To Knowledge Gateway',
      issue_prefix: 'TOK',
      access: 'legacy_membership_warning',
      active_user_members: 11,
      agents: 10,
      issues: 0,
      blocker: 'tok_owner_membership_not_repaired',
    },
  ],
  agents: [
    { company: 'E copier Solutions', issue_prefix: 'ECO', count: 2, state: 'read_only_visible' },
    { company: 'To Knowledge Gateway', issue_prefix: 'TOK', count: 10, state: 'blocked_for_owner_until_membership_repair' },
  ],
  issues: [
    { company: 'E copier Solutions', issue_prefix: 'ECO', count: 6, state: 'read_only_visible' },
    { company: 'To Knowledge Gateway', issue_prefix: 'TOK', count: 0, state: 'blocked_for_owner_until_membership_repair' },
  ],
}

function safeDashboard(prefix = PAPERCLIP_OWNER_PREFIX) {
  return `${PAPERCLIP_BASE_URL}/${prefix}/dashboard`
}

function safeAgents(prefix = PAPERCLIP_OWNER_PREFIX) {
  return `${PAPERCLIP_BASE_URL}/${prefix}/agents`
}

function safeIssues(prefix = PAPERCLIP_OWNER_PREFIX) {
  return `${PAPERCLIP_BASE_URL}/${prefix}/issues`
}

function run(command: string, args: string[], timeout = 3500): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
      })
    })
  })
}

async function readPaperclipDbSnapshot(): Promise<PaperclipSnapshot> {
  if (!existsSync(PAPERCLIP_ROOT)) return FALLBACK_SNAPSHOT

  const script = `
const postgresMod = await import('postgres');
const postgres = postgresMod.default || postgresMod;
const sql = postgres('postgres://127.0.0.1:54329/postgres', { max: 1, idle_timeout: 1, connect_timeout: 2 });
try {
  const companies = await sql\`
    select c.name, c.issue_prefix,
      count(distinct cm.id) filter (where cm.status = 'active' and cm.principal_type = 'user')::int as active_user_members,
      count(distinct a.id)::int as agents,
      count(distinct i.id)::int as issues
    from companies c
    left join company_memberships cm on cm.company_id = c.id
    left join agents a on a.company_id = c.id
    left join issues i on i.company_id = c.id and i.hidden_at is null
    where c.status = 'active'
    group by c.id, c.name, c.issue_prefix
    order by c.created_at desc
  \`;
  const agents = await sql\`
    select c.name as company, c.issue_prefix, a.name, a.role, a.status
    from agents a
    join companies c on c.id = a.company_id
    order by c.created_at desc, a.updated_at desc
    limit 50
  \`;
  const issues = await sql\`
    select c.name as company, c.issue_prefix, i.identifier, i.title, i.status, i.priority
    from issues i
    join companies c on c.id = i.company_id
    where i.hidden_at is null
    order by c.created_at desc, i.updated_at desc
    limit 50
  \`;
  console.log(JSON.stringify({ companies, agents, issues }));
} finally {
  await sql.end({ timeout: 1 });
}
`

  const result = await run('bash', ['-lc', `cd ${PAPERCLIP_ROOT} && pnpm --filter @paperclipai/db exec node --input-type=module <<'NODE'\n${script}\nNODE`])
  if (!result.ok) return { ...FALLBACK_SNAPSHOT, read_error: 'paperclip_db_snapshot_unavailable' }

  try {
    const parsed = JSON.parse(result.stdout) as {
      companies?: Array<Record<string, unknown>>
      agents?: Array<Record<string, unknown>>
      issues?: Array<Record<string, unknown>>
    }
    const companies = (parsed.companies || [])
      .map((company): PaperclipCompany => {
        const issuePrefix = String(company.issue_prefix || '')
        return {
          name: String(company.name || ''),
          issue_prefix: issuePrefix,
          access: issuePrefix === PAPERCLIP_OWNER_PREFIX ? 'owner_accessible' : 'legacy_membership_warning',
          active_user_members: Number(company.active_user_members || 0),
          agents: Number(company.agents || 0),
          issues: Number(company.issues || 0),
          blocker: issuePrefix === PAPERCLIP_OWNER_PREFIX ? undefined : 'tok_owner_membership_not_repaired',
        }
      })
      .filter((company) => company.name && company.issue_prefix)

    if (!companies.length) return { ...FALLBACK_SNAPSHOT, read_error: 'paperclip_db_snapshot_empty' }

    return {
      source: 'paperclip_db_readonly',
      companies,
      agents: parsed.agents || [],
      issues: parsed.issues || [],
    }
  } catch (_error) {
    return { ...FALLBACK_SNAPSHOT, read_error: 'paperclip_db_snapshot_parse_failed' }
  }
}

async function probeHealth() {
  try {
    const response = await fetch(`${PAPERCLIP_BASE_URL}/api/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    })
    const payload = await response.json().catch(() => null)
    return {
      http_status: response.status,
      ok: response.ok,
      deployment_mode: payload && typeof payload === 'object' && 'deploymentMode' in payload ? String(payload.deploymentMode) : 'unknown',
      bootstrap_status: payload && typeof payload === 'object' && 'bootstrapStatus' in payload ? String(payload.bootstrapStatus) : 'unknown',
      bootstrap_invite_active: payload && typeof payload === 'object' && 'bootstrapInviteActive' in payload ? Boolean(payload.bootstrapInviteActive) : false,
    }
  } catch (_error) {
    return {
      http_status: 0,
      ok: false,
      deployment_mode: 'unknown',
      bootstrap_status: 'unknown',
      bootstrap_invite_active: false,
    }
  }
}

export async function paperclipLiveStatus(resource = 'status') {
  const [health, snapshot] = await Promise.all([probeHealth(), readPaperclipDbSnapshot()])
  const activeCompany = snapshot.companies.find((company) => company.issue_prefix === PAPERCLIP_OWNER_PREFIX) || snapshot.companies[0]
  const companyReady = Boolean(health.ok && activeCompany?.access === 'owner_accessible')
  const ownerPrefix = activeCompany?.issue_prefix || PAPERCLIP_OWNER_PREFIX
  const items = resource === 'companies'
    ? snapshot.companies
    : resource === 'agents'
      ? snapshot.agents
      : resource === 'issues'
        ? snapshot.issues
        : []

  return {
    route: resource === 'status' ? 'paperclip.status' : `bridge.paperclip.${resource}`,
    state: companyReady ? 'READ_ONLY' : 'OWNER_GATED',
    blocker_class: companyReady ? 'NONE' : 'OWNER_GATED',
    transport_status: health.ok ? 'installed_reachable_tailnet' : 'unreachable',
    ui_status: health.ok ? 'reachable' : 'unreachable',
    health_status: health.ok ? 'ok' : 'failed',
    auth_status: health.ok ? 'authenticated_deployment' : 'unknown',
    company_access_status: companyReady ? 'ready' : 'blocked',
    bridge_read_status: companyReady ? 'read_only_live' : 'status_only_until_company_claim',
    write_status: 'bridge_gated',
    overall_status: companyReady ? 'INSTALLED / READY - WRITES BRIDGE-GATED' : 'INSTALLED / PARTIAL - COMPANY ACCESS REQUIRED',
    exact_blocker: companyReady ? 'paperclip_writes_bridge_gated' : 'paperclip_owner_company_claim_required',
    owner_visible_status_label: companyReady ? 'INSTALLED / READY - WRITES BRIDGE-GATED' : 'INSTALLED / PARTIAL - COMPANY ACCESS REQUIRED',
    open_ui_enabled: health.ok,
    company_data_enabled: companyReady,
    writes_bridge_gated: true,
    active_company: activeCompany || null,
    companies: snapshot.companies,
    items,
    items_state: companyReady ? 'read_only_live' : 'blocked_until_official_company_claim',
    data_source: snapshot.source,
    read_error: snapshot.read_error || null,
    legacy_company_warning: 'To Knowledge Gateway (TOK) can still show owner access errors. Mission Control routes owner Paperclip work to E copier Solutions (ECO) until TOK membership is repaired.',
    tailnet_url: safeDashboard(ownerPrefix),
    owner_login_url: safeDashboard(ownerPrefix),
    company_dashboard_url: safeDashboard(ownerPrefix),
    agent_roster_url: safeAgents(ownerPrefix),
    task_queue_url: safeIssues(ownerPrefix),
    health_endpoint: `${PAPERCLIP_BASE_URL}/api/health`,
    health_probe: health,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    protected_execution_enabled: false,
    credential_values_exposed: false,
    fake_success_allowed: false,
    no_go_claim: true,
    go_claim_allowed: false,
    next_action: companyReady
      ? 'Use the owner-accessible ECO Paperclip company for live reads. Keep writes Bridge-gated; repair TOK membership only if that legacy company must stay active.'
      : 'Complete the official Paperclip company claim in the owner browser, then re-run the bridge reads. Mission Control will not store Paperclip credentials.',
  }
}
