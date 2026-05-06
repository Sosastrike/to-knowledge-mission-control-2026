import { buildSpaceAgentDocumentationPage } from '@/lib/space-agent-docs'

export default function SpaceAgentGatewayDocumentationPage() {
  const doc = buildSpaceAgentDocumentationPage()

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
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
