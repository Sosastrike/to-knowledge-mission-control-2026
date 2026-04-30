// ─────────────────────────────────────────────────────────────────────
//  src/app/viral-crawl/page.tsx
//
//  Viral Crawl — read-only clarity page.
//
//  Two distinct pillars, clearly labelled so the owner never confuses
//  FireCrawl (web crawling) with claude-video (video watching):
//
//    A. Web / Browser Crawl   — FireCrawl backend
//    B. Video Intelligence    — claude-video /watch backend
//
//  Server Component. Reads:
//    - FireCrawl: process.env.FIRECRAWL_API_KEY + SDK install probe
//    - Video Intelligence: filesystem probes for the install paths
//
//  Sacred invariants:
//    - NO execution (no jobs, no API calls beyond local FS / env probes)
//    - NO secret values rendered (only credential-name + present:bool)
//    - NO .env edits
//    - NO Tony / voice / routing / Zapier writes
// ─────────────────────────────────────────────────────────────────────
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Viral Crawl · Mission Control',
  description: 'Web Crawl (FireCrawl) and Video Intelligence (claude-video) — two distinct pillars.',
}

export const dynamic = 'force-dynamic'

// ── Pillar A — FireCrawl status (env + SDK presence) ────────────────
function firecrawlStatus() {
  const keyPresent = Boolean((process.env.FIRECRAWL_API_KEY || '').trim())
  const sdkPath = join(process.cwd(), 'node_modules', '@mendable', 'firecrawl-js', 'package.json')
  const sdkLoaded = existsSync(sdkPath)
  const state: 'CREDENTIAL_REQUIRED' | 'BACKEND_REQUIRED' | 'LIVE' = !keyPresent
    ? 'CREDENTIAL_REQUIRED'
    : !sdkLoaded
    ? 'BACKEND_REQUIRED'
    : 'LIVE'
  return {
    state,
    keyPresent,
    sdkLoaded,
    nextAction: !keyPresent
      ? 'Owner adds FIRECRAWL_API_KEY through the approved secret manager.'
      : !sdkLoaded
      ? 'Wire FireCrawl SDK job runner and persistence tables.'
      : 'Ready to run scrape/extract/crawl jobs.',
  }
}

// ── Pillar B — Video Intelligence status (filesystem probes) ────────
function videoIntelligenceStatus() {
  const skillRoot = '/home/tony/claudeclaw/vendor/skills/claude-video'
  const skillReadme = join(skillRoot, 'SKILL.md')
  const wrapperPath = '/home/tony/claudeclaw/scripts/claude-video-to-brain.mjs'
  const dbInstaller = '/home/tony/claudeclaw/scripts/install-viral-crawl-tables.mjs'
  const watchEnv = '/home/tony/.config/watch/.env'
  const vaultPath = '/home/tony/obsidian-vault/07-Knowledge/Viral Crawl/Video Intelligence'

  const skillInstalled = existsSync(skillReadme)
  const wrapperInstalled = existsSync(wrapperPath)
  const dbInstallerPresent = existsSync(dbInstaller)
  const watchEnvPresent = existsSync(watchEnv)

  // Mode bits: only `0600` is acceptable for the watch env
  let watchEnvMode: string | null = null
  if (watchEnvPresent) {
    try {
      const m = statSync(watchEnv).mode & 0o777
      watchEnvMode = '0' + m.toString(8)
    } catch {
      /* ignore */
    }
  }

  const vaultFolderExists = existsSync(vaultPath)

  // State machine:
  //   skill missing                      -> BACKEND_REQUIRED
  //   skill present, wrapper missing     -> BACKEND_REQUIRED
  //   skill+wrapper present, env missing -> BACKEND_READY_CLI (but Whisper disabled)
  //   skill+wrapper+env present          -> BACKEND_READY_CLI (full)
  const state: 'BACKEND_REQUIRED' | 'BACKEND_READY_CLI' =
    skillInstalled && wrapperInstalled ? 'BACKEND_READY_CLI' : 'BACKEND_REQUIRED'

  return {
    state,
    skillInstalled,
    wrapperInstalled,
    dbInstallerPresent,
    watchEnvPresent,
    watchEnvMode,
    vaultFolderExists,
    skillRoot,
    wrapperPath,
    vaultPath,
    nextAction:
      state === 'BACKEND_REQUIRED'
        ? 'Run the install script: clone vendor/skills/claude-video and create the wrapper.'
        : !watchEnvPresent
        ? 'Bridge GROQ_API_KEY/OPENAI_API_KEY into ~/.config/watch/.env (mode 0600).'
        : 'Ready. Use the wrapper to analyze a public URL or local file.',
  }
}

// ── State badge ──────────────────────────────────────────────────────
function StateBadge({ state }: { state: string }) {
  const colorClass: Record<string, string> = {
    LIVE: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    BACKEND_READY_CLI: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    CREDENTIAL_REQUIRED: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    BACKEND_REQUIRED: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${colorClass[state] ?? 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/30'}`}>
      {state}
    </span>
  )
}

function YesNo({ ok, yes = 'present', no = 'missing' }: { ok: boolean; yes?: string; no?: string }) {
  return (
    <span className={`text-xs ${ok ? 'text-emerald-400' : 'text-rose-400'}`}>
      {ok ? `✓ ${yes}` : `✗ ${no}`}
    </span>
  )
}

// ── Page ─────────────────────────────────────────────────────────────
export default function ViralCrawlPage() {
  const fc = firecrawlStatus()
  const vi = videoIntelligenceStatus()

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">Viral Crawl</h1>
        <p className="text-sm text-zinc-400">
          Two distinct pillars, one shared foundation. Web crawling and video watching are{' '}
          <strong className="text-zinc-200">separate features</strong> — they share the same Brain
          vault and approval workflow, but each uses its own engine.
        </p>
      </header>

      {/* ───── Pillar A · Web / Browser Crawl (FireCrawl) ────────── */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-zinc-100">A · Web / Browser Crawl</h2>
              <StateBadge state={fc.state} />
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Powered by <strong>FireCrawl</strong>. For websites, browser sessions, scrape, extract, crawl, and monitor.{' '}
              <em className="text-zinc-500">Not for video.</em>
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Credential</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-mono text-xs text-zinc-300">FIRECRAWL_API_KEY</span>
              <YesNo ok={fc.keyPresent} />
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wider text-zinc-500">SDK install</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-mono text-xs text-zinc-300">@mendable/firecrawl-js</span>
              <YesNo ok={fc.sdkLoaded} />
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Next action</div>
          <p className="mt-1 text-sm text-zinc-300">{fc.nextAction}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <Capability label="Scrape page" enabled={fc.state === 'LIVE'} />
          <Capability label="Extract (LLM)" enabled={fc.state === 'LIVE'} />
          <Capability label="Crawl subpages" enabled={fc.state === 'LIVE'} />
          <Capability label="Schedule recurring" enabled={fc.state === 'LIVE'} />
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          Status endpoint: <code className="font-mono">/api/firecrawl/status</code>. Read-only —
          this page does <strong className="text-zinc-300">not</strong> trigger jobs.
        </p>
      </section>

      {/* ───── Pillar B · Video Intelligence (claude-video) ──────── */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-zinc-100">B · Video Intelligence / Watch Video</h2>
              <StateBadge state={vi.state} />
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Powered by <strong>claude-video</strong> (the <code className="font-mono">/watch</code> skill).
              For video URLs and local video files.{' '}
              <em className="text-zinc-500">Not for web pages.</em>
            </p>
            <p className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
              <strong>Video Intelligence is installed and syncing to Obsidian.</strong> UI execution is not enabled yet — use the CLI command below until the queue/UI surface is approved (deferred Phase F).
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Skill installed</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="truncate font-mono text-xs text-zinc-300">{vi.skillRoot}</span>
              <YesNo ok={vi.skillInstalled} />
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Brain wrapper</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="truncate font-mono text-xs text-zinc-300">scripts/claude-video-to-brain.mjs</span>
              <YesNo ok={vi.wrapperInstalled} />
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Whisper config</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="truncate font-mono text-xs text-zinc-300">
                ~/.config/watch/.env{vi.watchEnvMode ? ` (${vi.watchEnvMode})` : ''}
              </span>
              <YesNo ok={vi.watchEnvPresent} />
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Brain destination</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="truncate font-mono text-xs text-zinc-300">07-Knowledge/Viral Crawl/Video Intelligence/</span>
              <YesNo ok={vi.vaultFolderExists} yes="folder ready" no="empty (created on first run)" />
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="text-xs uppercase tracking-wider text-zinc-500">How to use (CLI today)</div>
          <pre className="mt-2 overflow-x-auto rounded bg-zinc-950 p-3 text-xs text-zinc-300">
{`node /home/tony/claudeclaw/scripts/claude-video-to-brain.mjs \\
     "<URL or local path>" \\
     <agent: tony|researcher|pacman|loom|growth|builder|forge> \\
     <purpose: summarize|learn_skill|competitor_research|...> \\
     [--start MM:SS] [--end MM:SS] [--no-whisper]`}
          </pre>
          <p className="mt-2 text-xs text-zinc-500">{vi.nextAction}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <Capability label="Watch URL" enabled={vi.state === 'BACKEND_READY_CLI'} />
          <Capability label="Watch local file" enabled={vi.state === 'BACKEND_READY_CLI'} />
          <Capability label="Brain note" enabled={vi.state === 'BACKEND_READY_CLI'} />
          <Capability label="Drag/drop UI" enabled={false} note="deferred (Phase F)" />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <Bullet label="Granted agents">
            tony · researcher · pacman · loom · growth · builder · forge
          </Bullet>
          <Bullet label="Status surfaces">
            <code className="font-mono">/api/viral-crawl/video/status</code> · DB <code className="font-mono">agent_skills.watch_video</code>
          </Bullet>
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          Read-only — this page does <strong className="text-zinc-300">not</strong> download videos.
          Use the CLI command above (or a future drag/drop UI) to actually run an analysis.
        </p>
      </section>

      {/* ───── Why these are separate ──────────────────────────────── */}
      <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/20 p-5">
        <h3 className="text-sm font-semibold text-zinc-200">Why two pillars</h3>
        <p className="mt-2 text-xs text-zinc-400">
          FireCrawl handles <strong>web pages</strong> (HTML, JS-rendered, sitemaps, scrape/extract).
          claude-video handles <strong>videos</strong> (download, frame extraction, transcript via captions or Whisper).
          They share the Brain vault, the approval flow, and the schedule infrastructure — but
          each one needs its own engine, its own credentials, and its own input UX.
          The two pillars must never be conflated.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          For the full design: <code className="font-mono">docs/VIRAL_CRAWL_VIDEO_INTELLIGENCE_SPEC.md</code>.
          For the operator runbook: <code className="font-mono">docs/VIRAL_CRAWL_VIDEO_OPERATOR_RUNBOOK.md</code>.
        </p>
      </section>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────
function Capability({ label, enabled, note }: { label: string; enabled: boolean; note?: string }) {
  return (
    <div className={`rounded-md border px-2.5 py-1.5 ${enabled ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300' : 'border-zinc-800 bg-zinc-950/40 text-zinc-500'}`}>
      <div className="flex items-center gap-1.5">
        <span>{enabled ? '✓' : '○'}</span>
        <span>{label}</span>
      </div>
      {note ? <div className="mt-0.5 text-2xs opacity-70">{note}</div> : null}
    </div>
  )
}

function Bullet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-zinc-300">{children}</div>
    </div>
  )
}
