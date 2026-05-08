// ============================================================
// Workspace left rail — sits between topbar and main content.
// Shows Mission Control (default), Brain sync, Email & SMTP.
// Preserves existing single-scroll Mission Control behavior.
// ============================================================

const WORKSPACE_PAGES = [
  { id:'mission',    label:'Mission Control', icon:'Mission' },
  { id:'brain-sync', label:'Brain sync',      icon:'Brain' },
  { id:'mirofish',   label:'MiroFish',        icon:'Sparkle' },
  { id:'gateway', label:'Gateway', icon:'Network' },
  { id:'firecrawl',  label:'FireCrawl',       icon:'Search' },
  { id:'zapier',     label:'Zapier',          icon:'Zap' },
  { id:'n8n',        label:'n8n',             icon:'Activity' },
  { id:'mcp-tools',  label:'MCP Tools',       icon:'Plug' },
  { id:'skills',     label:'Skills',          icon:'Sparkle' },
  { id:'reports',    label:'Reports',         icon:'FileLog' },
  { id:'email-smtp', label:'Email & SMTP',    icon:'Mail' },
];

function WorkspaceRail({ page, onPage }) {
  return (
    <nav className="ws-rail" aria-label="Workspace">
      {WORKSPACE_PAGES.map(p => {
        const IconCmp = I[p.icon] || I.Mission;
        const active = page === p.id;
        return (
          <button
            key={p.id}
            className={`ws-rail-btn ${active ? 'active' : ''}`}
            onClick={()=>{
              if (p.id === 'gateway') { window.location.href = '/gateway'; return; }
              onPage(p.id);
            }}
            title={p.label}
            aria-current={active ? 'page' : undefined}
          >
            <IconCmp size={16}/>
            <span>{p.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

Object.assign(window, { WORKSPACE_PAGES, WorkspaceRail });
