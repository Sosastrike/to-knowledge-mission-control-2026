import { buildSpaceAgentDocumentationPage } from '@/lib/space-agent-docs'

export default function SpaceAgentGatewayDocumentationPage() {
  const doc = buildSpaceAgentDocumentationPage()

  return (
    <main className="h-full overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <section className="rounded-lg border border-border bg-card/30 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="SpaceAgent exits" className="flex flex-wrap gap-2">
              <a href="/tkmc" className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold hover:border-cyan-300/40">Mission Control Home</a>
              <a href="/gateway" className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold hover:border-cyan-300/40">Gateway Overview</a>
              <a href="/gateway/agent-hub" className="rounded-md border border-cyan-300/40 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-100">Agent Hub</a>
            </nav>
            <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
              <a href="/tkmc" className="font-semibold text-cyan-200 hover:text-cyan-100">Mission Control</a>
              <span className="px-1.5 text-muted-foreground/60">/</span>
              <a href="/gateway" className="font-semibold text-cyan-200 hover:text-cyan-100">Gateway</a>
              <span className="px-1.5 text-muted-foreground/60">/</span>
              <span className="font-semibold text-foreground">SpaceAgent</span>
            </nav>
          </div>
        </section>

        <header className="border-b border-border pb-6">
          <p className="text-sm font-medium uppercase text-muted-foreground">Gateway Node</p>
          <h1 className="mt-3 text-4xl font-semibold">{doc.title}</h1>
          <p className="mt-3 max-w-3xl text-base text-muted-foreground">{doc.subtitle}</p>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Commander</dt>
              <dd className="font-medium">Agent Zero</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Lieutenant</dt>
              <dd className="font-medium">Hermes</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Dispatcher</dt>
              <dd className="font-medium">Pi shadow mode</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Execution</dt>
              <dd className="font-medium">Read-only by default</dd>
            </div>
          </dl>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {doc.sections.map((section) => (
            <article key={section.id} className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{section.summary}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {section.bullets.map((item) => (
                  <li key={item} className="leading-6 text-card-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
