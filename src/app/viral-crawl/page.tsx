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
//  Server Component. Uses the same canonical status helpers as the
//  /api/firecrawl/status and /api/viral-crawl/video/status endpoints.
//
//  Sacred invariants:
//    - NO execution (no jobs, no downloads, no API write side-effects)
//    - NO secret values rendered (only credential-name + present:bool)
//    - NO .env edits
//    - NO Tony / voice / routing / Zapier writes
// ─────────────────────────────────────────────────────────────────────
import type { Metadata } from 'next'
import { getFirecrawlStatus } from '@/lib/firecrawl-status'
import { getViralCrawlVideoStatus } from '@/lib/viral-crawl-status'

export const metadata: Metadata = {
  title: 'Viral Crawl · Mission Control',
  description: 'Web Crawl (FireCrawl) and Video Intelligence (claude-video) — two distinct pillars.',
}

export const dynamic = 'force-dynamic'

// ── State badge ──────────────────────────────────────────────────────
function StateBadge({ state }: { state: string }) {
  const colorClass: Record<string, string> = {
    LIVE: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    BACKEND_READY_CLI: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    READ_ONLY: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
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
  const fc = getFirecrawlStatus()
  const vi = getViralCrawlVideoStatus()

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

        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="text-xs uppercase tracking-wider text-amber-300">FireCrawl-specific blocker</div>
          <p className="mt-1 text-sm text-zinc-300">
            Mission Control is missing <code className="font-mono text-amber-300">FIRECRAWL_API_KEY</code> and the{' '}
            <code className="font-mono text-amber-300">@mendable/firecrawl-js</code> SDK. {fc.nextAction}
          </p>
          <p className="mt-2 text-2xs text-zinc-500">
            This is a FireCrawl-only blocker. The Brain / Obsidian vault is live and unrelated.
          </p>
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
              <span className="truncate font-mono text-xs text-zinc-300">{vi.vendor_skill_path}</span>
              <YesNo ok={vi.vendor_skill_present} />
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Brain wrapper</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="truncate font-mono text-xs text-zinc-300">scripts/claude-video-to-brain.mjs</span>
              <YesNo ok={vi.wrapper_present} />
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Whisper config</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="truncate font-mono text-xs text-zinc-300">
                Protected runtime config{vi.watchEnvMode ? ` (${vi.watchEnvMode})` : ''}
              </span>
              <YesNo ok={vi.watchEnvPresent} />
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Brain destination</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="truncate font-mono text-xs text-zinc-300">07-Knowledge/Viral Crawl/Video Intelligence/</span>
              <YesNo ok={vi.obsidian_destination_present} yes="folder ready" no="empty (created on first run)" />
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Skill registry</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-mono text-xs text-zinc-300">{vi.skill_name}</span>
              <span className={`text-xs ${vi.skill_present && vi.skill_enabled ? 'text-emerald-400' : 'text-rose-400'}`}>
                {vi.skill_present && vi.skill_enabled ? `✓ enabled · health=${vi.skill_health}` : '✗ not registered'}
              </span>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Brain notes</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-mono text-xs text-zinc-300">{vi.notes_count} markdown note{vi.notes_count === 1 ? '' : 's'}</span>
              <span className="text-xs text-zinc-500">live count from vault</span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Command template (CLI today)</div>
            <span className="text-2xs text-zinc-500">
              execution_enabled: <span className="text-rose-300">false</span> · UI runner deferred (Phase F)
            </span>
          </div>
          <pre className="mt-2 overflow-x-auto rounded bg-zinc-950 p-3 text-xs text-zinc-300">{vi.command_template}</pre>
          <pre className="mt-2 overflow-x-auto rounded bg-zinc-950 p-3 text-xs text-zinc-400">
{`# Full form
node <OpenClaw+ video-to-brain wrapper> \\
     "<URL or local path>" \\
     <agent: tony|researcher|pacman|loom|growth|builder|forge> \\
     <purpose: summarize|learn_skill|competitor_research|...> \\
     [--start MM:SS] [--end MM:SS] [--no-whisper]`}</pre>
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
