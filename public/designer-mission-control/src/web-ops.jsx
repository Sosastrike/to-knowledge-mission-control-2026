// Addendum 04 — Web Operations / Site Navigation
// Provider-agnostic framework for browser/web agents (Firecrawl + future).
// Dashboard widget + drill-down workspace, inside the same Mission Control.

/* ============================================================
   DATA — shape mirrors /api/web-ops/* endpoints from the addendum.
   ============================================================ */
const WEBOPS_PROVIDERS_SEED = [
  {
    id:'firecrawl',
    key:'firecrawl',
    name:'Firecrawl',
    type:'crawler',                // crawler | browser | scraper | headless
    status:'healthy',              // healthy | degraded | offline | pending
    version:'1.14.2',
    region:'us-east-1',
    config:'fc-live-prod',
    lastTestAt:'2m ago',
    lastSyncAt:'14s ago',
    error:null,
    capabilities:['crawl','extract','screenshot','actions','search','map','watch'],
    modes:['scrape','crawl','map','search','extract','watch'],
  },
  {
    id:'playwright',
    key:'playwright',
    name:'Playwright runner',
    type:'browser',
    status:'healthy',
    version:'1.45',
    region:'on-cluster',
    config:'pw-pool-4',
    lastTestAt:'6m ago',
    lastSyncAt:'8s ago',
    error:null,
    capabilities:['actions','screenshot','network-capture','forms'],
    modes:['session','actions'],
  },
  {
    id:'browserbase',
    key:'browserbase',
    name:'Browserbase',
    type:'browser',
    status:'degraded',
    version:'cloud',
    region:'us-west-2',
    config:'bb-prod',
    lastTestAt:'12m ago',
    lastSyncAt:'4m ago',
    error:'2 sessions queued · latency p95 + 480ms',
    capabilities:['actions','screenshot','stealth'],
    modes:['session','actions'],
  },
  {
    id:'apify',
    key:'apify',
    name:'Apify',
    type:'scraper',
    status:'offline',
    version:'—',
    region:'—',
    config:'—',
    lastTestAt:'3d ago',
    lastSyncAt:'—',
    error:'Not configured',
    capabilities:[],
    modes:[],
  },
];

const WEBOPS_SESSIONS_SEED = [
  {
    id:'WS-4412',
    providerId:'firecrawl',
    agent:'Agent Zero',
    project:'BluePeak renewal',
    task:'Confirm renewal pricing tiers',
    domain:'bluepeak.io',
    url:'https://bluepeak.io/pricing',
    status:'navigating',
    started:'14:28',
    duration:'4m 12s',
    skill:'web-research',
    model:'sonnet-4.5',
    tool:'firecrawl.extract',
    pages:4,
    actions:11,
    extracted:3,
    warnings:0,
    errors:0,
    summary:'Agent Zero is reviewing the target website to locate pricing information.',
  },
  {
    id:'WS-4411',
    providerId:'playwright',
    agent:'Atlas',
    project:'Support tier-2',
    task:'File refund on behalf of @sofia_m',
    domain:'portal.stripe.com',
    url:'https://portal.stripe.com/refunds/new',
    status:'submitting',
    started:'14:24',
    duration:'2m 38s',
    skill:'refund-flow',
    model:'sonnet-4.5',
    tool:'playwright.action',
    pages:3,
    actions:28,
    extracted:0,
    warnings:1,
    errors:0,
    summary:'Atlas is filling the refund form. Waiting for Stripe 2-step confirmation.',
  },
  {
    id:'WS-4410',
    providerId:'firecrawl',
    agent:'Research',
    project:'Q2 market scan',
    task:'Competitor pricing deep-dive',
    domain:'nestservices.com',
    url:'https://nestservices.com/plans',
    status:'extracting',
    started:'14:09',
    duration:'21m 04s',
    skill:'brief-weekly',
    model:'opus-4.1',
    tool:'firecrawl.crawl',
    pages:42,
    actions:0,
    extracted:17,
    warnings:0,
    errors:0,
    summary:'Research is crawling the competitor plan pages and extracting tier data.',
  },
  {
    id:'WS-4409',
    providerId:'browserbase',
    agent:'Orion',
    project:'Support tier-2',
    task:'Check delivery status for @mkim',
    domain:'fedex.com',
    url:'https://fedex.com/track/742008',
    status:'warning',
    started:'14:02',
    duration:'11m 18s',
    skill:'refund-flow',
    model:'haiku-4.5',
    tool:'browserbase.action',
    pages:2,
    actions:6,
    extracted:1,
    warnings:2,
    errors:0,
    summary:'FedEx portal returned a CAPTCHA. Orion is retrying via a fresh session.',
  },
  {
    id:'WS-4408',
    providerId:'firecrawl',
    agent:'Lyra',
    project:'Anomaly detection',
    task:'Probe public status pages',
    domain:'status.stripe.com',
    url:'https://status.stripe.com',
    status:'complete',
    started:'13:41',
    duration:'1m 04s',
    skill:'memory-trim',
    model:'sonnet-4.5',
    tool:'firecrawl.extract',
    pages:1,
    actions:0,
    extracted:1,
    warnings:0,
    errors:0,
    summary:'Lyra captured the current Stripe status snapshot. No incidents.',
  },
  {
    id:'WS-4407',
    providerId:'playwright',
    agent:'Atlas',
    project:'Onboarding ops',
    task:'Create trial accounts for pilot customers',
    domain:'app.to-knowledge.com',
    url:'https://app.to-knowledge.com/admin/trials',
    status:'failed',
    started:'13:22',
    duration:'3m 48s',
    skill:'onboarding',
    model:'haiku-4.5',
    tool:'playwright.action',
    pages:4,
    actions:19,
    extracted:0,
    warnings:1,
    errors:2,
    summary:'Form submission failed — SSO redirect broke the flow. Atlas paused for review.',
  },
];

const WEBOPS_EVENTS_SEED = [
  { t:'14:32:18', sessionId:'WS-4412', agent:'Agent Zero',     kind:'navigate',  human:'Opened bluepeak.io/pricing to look for renewal tiers.' },
  { t:'14:32:02', sessionId:'WS-4412', agent:'Agent Zero',     kind:'action',    human:'Dismissed cookie banner and expanded "Enterprise" section.' },
  { t:'14:31:40', sessionId:'WS-4411', agent:'Atlas',    kind:'action',    human:'Filled refund amount $248.00 and submitted first step.' },
  { t:'14:31:12', sessionId:'WS-4411', agent:'Atlas',    kind:'warning',   human:'Stripe requires 2-step confirmation — waiting up to 2 minutes.' },
  { t:'14:30:44', sessionId:'WS-4410', agent:'Research', kind:'extract',   human:'Extracted 3 new competitor tier prices from nestservices.com.' },
  { t:'14:30:11', sessionId:'WS-4409', agent:'Orion',    kind:'blocked',   human:'FedEx returned CAPTCHA — escalating to human-in-the-loop.' },
  { t:'14:28:04', sessionId:'WS-4412', agent:'Agent Zero',     kind:'start',     human:'Session started via Firecrawl (crawler). Target: bluepeak.io.' },
  { t:'14:24:18', sessionId:'WS-4411', agent:'Atlas',    kind:'start',     human:'Session started via Playwright (browser). Target: portal.stripe.com.' },
  { t:'14:22:40', sessionId:'WS-4408', agent:'Lyra',     kind:'sync',      human:'Stripe status snapshot added to shared memory (MemPalace).' },
  { t:'14:18:03', sessionId:'WS-4407', agent:'Atlas',    kind:'error',     human:'SSO redirect loop detected — Atlas paused the session.' },
];

const WEBOPS_PROJECTS_SEED = [
  {
    id:'WP-21',
    name:'BluePeak renewal — pricing tiers',
    mode:'extract',                 // scrape | crawl | map | search | extract | watch
    providerId:'firecrawl',
    target:'https://bluepeak.io/pricing',
    schedule:'one-off',             // one-off | hourly | daily | weekly | cron
    owner:'Agent Zero',
    project:'BluePeak renewal',
    status:'running',
    nextRun:'—',
    lastRun:'14:28',
    runs:1,
    schema:'{ tier: string, price: number, features: string[] }',
    prompt:'Capture each plan tier with its monthly price and listed features.',
  },
  {
    id:'WP-20',
    name:'Competitor plans deep-crawl',
    mode:'crawl',
    providerId:'firecrawl',
    target:'https://nestservices.com/*',
    schedule:'weekly',
    owner:'Research',
    project:'Q2 market scan',
    status:'running',
    nextRun:'Mon 09:00',
    lastRun:'14:09',
    runs:8,
    schema:'—',
    prompt:'Crawl all /plans, /pricing, /compare pages. Respect robots.txt.',
  },
  {
    id:'WP-19',
    name:'Stripe status watch',
    mode:'watch',
    providerId:'firecrawl',
    target:'https://status.stripe.com',
    schedule:'every 5m',
    owner:'Lyra',
    project:'Anomaly detection',
    status:'watching',
    nextRun:'in 3m',
    lastRun:'13:41',
    runs:412,
    schema:'{ status: string, incidents: number }',
    prompt:'Alert on any status change or new incident.',
  },
  {
    id:'WP-18',
    name:'FedEx delivery lookup',
    mode:'scrape',
    providerId:'browserbase',
    target:'https://fedex.com/track/{{tracking}}',
    schedule:'on-demand',
    owner:'Orion',
    project:'Support tier-2',
    status:'paused',
    nextRun:'—',
    lastRun:'14:02',
    runs:37,
    schema:'{ status: string, eta: string, history: event[] }',
    prompt:'Extract the current delivery status and history timeline.',
  },
  {
    id:'WP-17',
    name:'Competitor news mentions',
    mode:'search',
    providerId:'firecrawl',
    target:'query: "NestServices" OR "BluePeak" product launch',
    schedule:'daily',
    owner:'Research',
    project:'Q2 market scan',
    status:'scheduled',
    nextRun:'Tomorrow 06:00',
    lastRun:'Yesterday 06:00',
    runs:42,
    schema:'{ title, url, published, source }',
    prompt:'Return top 20 results from the last 24 hours.',
  },
];

const WEBOPS_MODES = [
  { id:'scrape',  label:'Scrape',   icon:'FileCode',  blurb:'Fetch one page, return clean markdown/HTML/JSON.' },
  { id:'crawl',   label:'Crawl',    icon:'Globe',     blurb:'Walk an entire site or subtree, respecting robots.txt.' },
  { id:'map',     label:'Map',      icon:'Sitemap',   blurb:'Discover every URL on a domain — fast sitemap.' },
  { id:'search',  label:'Search',   icon:'Search',    blurb:'Query the open web and return structured hits.' },
  { id:'extract', label:'Extract',  icon:'Sparkle',   blurb:'LLM-driven schema extraction from one or many pages.' },
  { id:'watch',   label:'Watch',    icon:'Eye',       blurb:'Re-run on a schedule, alert on diff or change.' },
];

/* A compact, deterministic screenshot-like preview (not a real cap) */
function WebOpsPreview({ session }) {
  const s = session;
  const host = s.domain;
  return (
    <div style={{
      position:'relative', width:'100%', aspectRatio:'16/10',
      background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)',
      overflow:'hidden', fontSize:11,
    }}>
      <div style={{display:'flex', alignItems:'center', gap:6, padding:'5px 8px', background:'var(--bg-1)', borderBottom:'1px solid var(--line-1)'}}>
        <span style={{width:8, height:8, borderRadius:4, background:'oklch(0.68 0.18 28)'}}/>
        <span style={{width:8, height:8, borderRadius:4, background:'oklch(0.82 0.15 78)'}}/>
        <span style={{width:8, height:8, borderRadius:4, background:'oklch(0.78 0.15 155)'}}/>
        <span className="mono" style={{marginLeft:6, color:'var(--fg-2)', fontSize:10}}>{host}</span>
        <span className="spacer"/>
        <span className="mono" style={{color:'var(--fg-3)', fontSize:9}}>rendered · {s.providerId}</span>
      </div>
      <div style={{padding:'12px 14px'}}>
        <div style={{width:'40%', height:10, background:'var(--line-2)', borderRadius:3, marginBottom:10}}/>
        <div style={{width:'72%', height:6, background:'var(--line-1)', borderRadius:3, marginBottom:5}}/>
        <div style={{width:'62%', height:6, background:'var(--line-1)', borderRadius:3, marginBottom:14}}/>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:10}}>
          {[0,1,2].map(i => (
            <div key={i} style={{height:62, background:'var(--bg-3)', borderRadius:4, border:'1px dashed var(--line-1)', position:'relative'}}>
              <div style={{position:'absolute', top:8, left:8, width:'50%', height:6, background:'var(--line-2)', borderRadius:2}}/>
              <div style={{position:'absolute', top:22, left:8, width:'80%', height:4, background:'var(--line-1)', borderRadius:2}}/>
              <div style={{position:'absolute', top:40, left:8, width:40, height:14, background:i===1?'var(--accent-soft)':'var(--line-2)', borderRadius:3}}/>
            </div>
          ))}
        </div>
        <div style={{width:'50%', height:6, background:'var(--line-1)', borderRadius:3, marginBottom:4}}/>
        <div style={{width:'42%', height:6, background:'var(--line-1)', borderRadius:3}}/>
      </div>
      <div style={{position:'absolute', top:'55%', left:'38%', width:28, height:28, borderRadius:14, border:'2px solid var(--accent)', boxShadow:'0 0 0 6px oklch(0.78 0.13 var(--accent-hue) / 0.15)', animation:'pulseDot 2s ease-out infinite'}}/>
      <div style={{position:'absolute', top:'55%', left:'38%', transform:'translate(34px,-8px)', fontSize:10, color:'var(--accent)', fontFamily:'var(--mono)', background:'var(--bg-0)', border:'1px solid var(--accent-line)', padding:'2px 6px', borderRadius:4}}>
        {s.agent} · {s.status}
      </div>
    </div>
  );
}


/* ============================================================
   Status helpers
   ============================================================ */
function webopsStatusKind(s) {
  if (s==='complete' || s==='healthy' || s==='running' || s==='watching') return 'ok';
  if (s==='warning' || s==='blocked' || s==='degraded' || s==='submitting' || s==='pending' || s==='paused' || s==='scheduled') return 'warn';
  if (s==='failed' || s==='error' || s==='offline') return 'err';
  return 'live';
}


/* ============================================================
   DASHBOARD WIDGET — compact preview (unchanged; reads seed data)
   ============================================================ */
const WEBOPS_PROVIDERS = WEBOPS_PROVIDERS_SEED;
const WEBOPS_SESSIONS  = WEBOPS_SESSIONS_SEED;
const WEBOPS_EVENTS    = WEBOPS_EVENTS_SEED;

function WebOpsCard({ onOpen }) {
  const sessions = WEBOPS_SESSIONS;
  const active = sessions.filter(s => !['complete','failed'].includes(s.status));
  const providers = WEBOPS_PROVIDERS;
  const healthy = providers.filter(p => p.status==='healthy').length;
  const head = active[0] || sessions[0];

  return (
    <div className="card col-8 hov" onClick={onOpen}>
      <div className="card-head">
        <div className="card-title">
          <I.Globe/>
          Web operations
          <span className="card-subtitle">site navigation · {providers.length} providers</span>
        </div>
        <div className="hstack">
          <span className="tag ok">{healthy}/{providers.length} healthy</span>
          <span className="card-link">Open workspace <I.ArrowRight/></span>
        </div>
      </div>
      <div className="card-body vstack">
        <div className="hstack" style={{padding:'9px 11px', background:'var(--accent-soft)', borderRadius:8, border:'1px solid var(--accent-line)', gap:10}}>
          <Avatar name={head.agent} size={22}/>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:12, color:'var(--fg-0)', lineHeight:1.45}} className="truncate">{head.summary}</div>
            <div className="mono xsmall muted" style={{marginTop:2}}>{head.domain} · {head.skill} · {head.model} · {head.duration}</div>
          </div>
          <StatusDot s={webopsStatusKind(head.status)}/>
        </div>

        <div>
          <div className="stat-label" style={{marginBottom:6}}>Active sessions ({active.length})</div>
          <div className="vstack" style={{gap:4}}>
            {active.slice(0, 4).map(s => {
              const prov = providers.find(p => p.id===s.providerId);
              return (
                <div key={s.id} className="hstack" style={{padding:'7px 10px', background:'var(--bg-2)', borderRadius:6, border:'1px solid var(--line-1)', gap:10}}>
                  <Avatar name={s.agent} size={20}/>
                  <div style={{flex:1, minWidth:0}}>
                    <div className="hstack" style={{gap:6, minWidth:0}}>
                      <span style={{fontSize:12, color:'var(--fg-0)', fontWeight:500, flexShrink:0}}>{s.agent}</span>
                      <span style={{color:'var(--fg-2)', fontSize:12}}>·</span>
                      <span className="mono xsmall" style={{color:'var(--fg-1)', minWidth:0}} title={s.url}>{s.domain}</span>
                    </div>
                    <div className="muted xsmall truncate">{s.task}</div>
                  </div>
                  <span className="tag xsmall">{prov?.name}</span>
                  <span className="status-pill">
                    <StatusDot s={webopsStatusKind(s.status)}/>
                    <span>{s.status}</span>
                  </span>
                  <span className="mono xsmall muted" style={{width:52, textAlign:'right'}}>{s.duration}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="hstack" style={{gap:8}}>
          {providers.map(p => (
            <div key={p.id} className="hstack" style={{flex:1, minWidth:0, padding:'6px 10px', background:'var(--bg-2)', borderRadius:6, border:'1px solid var(--line-1)', gap:8}}>
              <StatusDot s={webopsStatusKind(p.status)}/>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:11, color:'var(--fg-0)', fontWeight:500}} className="truncate">{p.name}</div>
                <div className="muted xsmall truncate">{p.type} · {p.version}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ============================================================
   Toast helper (inline, local to workspace)
   ============================================================ */
function useToast() {
  const [toast, setToast] = React.useState(null);
  const show = React.useCallback((msg, kind='ok') => {
    setToast({ msg, kind, id: Date.now() });
    setTimeout(() => setToast(null), 2400);
  }, []);
  const node = toast ? (
    <div style={{
      position:'fixed', bottom:24, right:24, zIndex:500,
      padding:'10px 14px', borderRadius:8,
      background:'var(--bg-0)', border:`1px solid ${toast.kind==='err'?'var(--err-line)':toast.kind==='warn'?'var(--warn-line)':'var(--accent-line)'}`,
      color:'var(--fg-0)', fontSize:12, maxWidth:380,
      boxShadow:'0 8px 28px rgba(0,0,0,0.5)',
    }}>
      <div className="hstack">
        {toast.kind==='err' ? <I.X size={12} style={{color:'var(--err)'}}/> :
         toast.kind==='warn' ? <I.AlertTriangle size={12} style={{color:'var(--warn)'}}/> :
         <I.Check size={12} style={{color:'var(--accent)'}}/>}
        <span>{toast.msg}</span>
      </div>
    </div>
  ) : null;
  return { show, node };
}


/* ============================================================
   NEW PROJECT / SESSION WIZARD
   ============================================================ */
function NewWebOpsProjectModal({ onClose, onCreate, providers }) {
  const [step, setStep] = React.useState(1);   // 1 mode · 2 target · 3 schedule · 4 review
  const [mode, setMode] = React.useState('extract');
  const [providerId, setProviderId] = React.useState('firecrawl');
  const [name, setName] = React.useState('');
  const [target, setTarget] = React.useState('');
  const [prompt, setPrompt] = React.useState('');
  const [schema, setSchema] = React.useState('');
  const [schedule, setSchedule] = React.useState('one-off');
  const [owner, setOwner] = React.useState('Agent Zero');
  const [err, setErr] = React.useState(null);

  const eligibleProviders = providers.filter(p => p.status!=='offline' && (p.modes||[]).includes(mode) || (p.modes||[]).includes('session'));

  React.useEffect(() => {
    // auto-pick first provider that supports this mode
    const fit = providers.find(p => p.status!=='offline' && (p.modes||[]).includes(mode));
    if (fit) setProviderId(fit.id);
  }, [mode]);

  const modeMeta = WEBOPS_MODES.find(m => m.id===mode);

  const next = () => {
    setErr(null);
    if (step===1 && !mode) { setErr('Choose a mode'); return; }
    if (step===2) {
      if (!name.trim()) { setErr('Name this project'); return; }
      if (!target.trim()) { setErr(mode==='search' ? 'Enter a search query' : 'Enter a target URL or pattern'); return; }
      if (mode!=='search' && !/^https?:\/\//i.test(target.trim())) { setErr('Target must start with http:// or https://'); return; }
    }
    setStep(s => Math.min(4, s+1));
  };

  const create = () => {
    const id = 'WP-' + Math.floor(Math.random()*900+100);
    onCreate({
      id, name: name.trim(), mode, providerId, target: target.trim(),
      prompt: prompt.trim() || '—', schema: schema.trim() || '—',
      schedule, owner,
      status: schedule==='one-off' ? 'running' : schedule==='on-demand' ? 'paused' : 'scheduled',
      nextRun: schedule==='one-off' ? '—' : schedule==='on-demand' ? '—' : 'pending',
      lastRun: '—',
      runs: 0,
      project: '—',
    });
  };

  return (
    <>
      <div className="panel-overlay" onClick={onClose} style={{zIndex:210}}/>
      <div className="modal" style={{maxWidth:680, zIndex:211}}>
        <div className="modal-head">
          <div>
            <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--fg-2)', fontWeight:600}}>Web operations · step {step} of 4</div>
            <h3 style={{margin:'2px 0 0', fontSize:16, color:'var(--fg-0)'}}>New web project</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><I.X size={14}/></button>
        </div>

        {/* step indicator */}
        <div className="hstack" style={{padding:'10px 18px', borderBottom:'1px solid var(--line-1)', gap:8}}>
          {['Mode','Target','Schedule','Review'].map((lbl, i) => (
            <div key={lbl} className="hstack" style={{flex:1, gap:6}}>
              <div style={{
                width:18, height:18, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10, fontFamily:'var(--mono)',
                background: step===i+1 ? 'var(--accent)' : step>i+1 ? 'var(--accent-soft)' : 'var(--bg-2)',
                color: step===i+1 ? 'var(--bg-0)' : step>i+1 ? 'var(--accent)' : 'var(--fg-2)',
                border:`1px solid ${step>=i+1?'var(--accent-line)':'var(--line-1)'}`,
              }}>{step>i+1 ? '✓' : i+1}</div>
              <span style={{fontSize:11, color: step===i+1?'var(--fg-0)':'var(--fg-2)'}}>{lbl}</span>
              {i<3 && <span style={{flex:1, height:1, background:'var(--line-1)'}}/>}
            </div>
          ))}
        </div>

        <div className="modal-body" style={{maxHeight:440, overflow:'auto'}}>
          {/* STEP 1 · MODE */}
          {step===1 && (
            <>
              <div className="stat-label" style={{marginBottom:8}}>What should the agent do?</div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8}}>
                {WEBOPS_MODES.map(m => {
                  const Icon = I[m.icon] || I.Globe;
                  const active = mode===m.id;
                  return (
                    <div key={m.id}
                      onClick={()=>setMode(m.id)}
                      style={{
                        padding:'10px 12px', borderRadius:8, cursor:'pointer',
                        background: active ? 'var(--accent-soft)' : 'var(--bg-2)',
                        border: `1px solid ${active?'var(--accent-line)':'var(--line-1)'}`,
                      }}>
                      <div className="hstack" style={{marginBottom:4}}>
                        <Icon size={14} style={{color: active?'var(--accent)':'var(--fg-1)'}}/>
                        <span style={{fontSize:13, color:'var(--fg-0)', fontWeight:600}}>{m.label}</span>
                      </div>
                      <div className="muted xsmall">{m.blurb}</div>
                    </div>
                  );
                })}
              </div>

              <div className="stat-label" style={{marginBottom:6, marginTop:14}}>Provider</div>
              <div className="hstack" style={{gap:6, flexWrap:'wrap'}}>
                {providers.filter(p => p.status!=='offline').map(p => {
                  const supports = (p.modes||[]).includes(mode);
                  const active = providerId===p.id;
                  return (
                    <button key={p.id}
                      className={`btn sm ${active?'primary':''}`}
                      disabled={!supports}
                      onClick={()=>setProviderId(p.id)}
                      style={{opacity: supports?1:0.4}}
                      title={supports?'':'does not support this mode'}>
                      <StatusDot s={webopsStatusKind(p.status)}/>
                      {p.name}
                      {!supports && <span className="muted xsmall" style={{marginLeft:4}}>(n/a)</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* STEP 2 · TARGET */}
          {step===2 && (
            <>
              <div className="stat-label" style={{marginBottom:4}}>Project name</div>
              <input className="input" style={{width:'100%', marginBottom:14}}
                placeholder={`e.g. ${modeMeta.label} — competitor pricing`}
                value={name} onChange={e=>setName(e.target.value)} autoFocus/>

              <div className="stat-label" style={{marginBottom:4}}>
                {mode==='search' ? 'Search query' :
                 mode==='crawl'  ? 'Starting URL (crawls all same-origin links)' :
                 mode==='map'    ? 'Domain to map' :
                 'Target URL'}
              </div>
              <input className="input mono xsmall" style={{width:'100%', marginBottom:14}}
                placeholder={
                  mode==='search' ? '"BluePeak" OR "NestServices" launch'
                  : mode==='crawl' ? 'https://nestservices.com/*'
                  : 'https://example.com/pricing'
                }
                value={target} onChange={e=>setTarget(e.target.value)}/>

              {(mode==='extract' || mode==='watch') && (
                <>
                  <div className="stat-label" style={{marginBottom:4}}>Extraction prompt <span className="muted">(what should the LLM pull out?)</span></div>
                  <textarea className="input" style={{width:'100%', minHeight:60, marginBottom:14, fontFamily:'inherit'}}
                    placeholder="Capture each pricing tier with its monthly price and listed features."
                    value={prompt} onChange={e=>setPrompt(e.target.value)}/>

                  <div className="stat-label" style={{marginBottom:4}}>JSON schema <span className="muted">(optional · structures the output)</span></div>
                  <textarea className="input mono xsmall" style={{width:'100%', minHeight:60, fontFamily:'var(--mono)'}}
                    placeholder="{ tier: string, price: number, features: string[] }"
                    value={schema} onChange={e=>setSchema(e.target.value)}/>
                </>
              )}

              {mode==='crawl' && (
                <div className="hstack" style={{padding:'9px 11px', background:'var(--bg-2)', borderRadius:6, border:'1px solid var(--line-1)', gap:8}}>
                  <I.Info size={12} style={{color:'var(--fg-2)'}}/>
                  <span className="muted xsmall">Crawl respects robots.txt and a 400-page cap per run. Change limits in Settings → Integrations.</span>
                </div>
              )}
            </>
          )}

          {/* STEP 3 · SCHEDULE */}
          {step===3 && (
            <>
              <div className="stat-label" style={{marginBottom:8}}>When should this run?</div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6, marginBottom:14}}>
                {[
                  {id:'one-off',   label:'Run once now',     sub:'One-shot · start immediately'},
                  {id:'on-demand', label:'On demand',        sub:'Only when called by an agent or API'},
                  {id:'hourly',    label:'Every hour',       sub:'Runs at :00 of each hour'},
                  {id:'daily',     label:'Daily',            sub:'Once per day at 06:00 local'},
                  {id:'weekly',    label:'Weekly',           sub:'Monday 09:00 local'},
                  {id:'watch-5m',  label:'Watch · every 5m', sub:'Alerts on diff or state change'},
                ].map(s => {
                  const active = schedule===s.id;
                  return (
                    <div key={s.id}
                      onClick={()=>setSchedule(s.id)}
                      style={{
                        padding:'10px 12px', borderRadius:6, cursor:'pointer',
                        background: active ? 'var(--accent-soft)' : 'var(--bg-2)',
                        border: `1px solid ${active?'var(--accent-line)':'var(--line-1)'}`,
                      }}>
                      <div style={{fontSize:13, color:'var(--fg-0)', fontWeight:500}}>{s.label}</div>
                      <div className="muted xsmall">{s.sub}</div>
                    </div>
                  );
                })}
              </div>

              <div className="stat-label" style={{marginBottom:4}}>Owner / responsible agent</div>
              <select className="select" value={owner} onChange={e=>setOwner(e.target.value)} style={{width:'100%'}}>
                {['Agent Zero','Hermes','Atlas','Orion','Lyra','Research','Ops'].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </>
          )}

          {/* STEP 4 · REVIEW */}
          {step===4 && (
            <>
              <div className="stat-label" style={{marginBottom:8}}>Review — will {schedule==='one-off' ? 'run immediately' : 'be scheduled'}</div>
              <div style={{padding:'12px 14px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
                <div style={{fontSize:14, color:'var(--fg-0)', fontWeight:600, marginBottom:8}}>{name}</div>
                <table className="tbl" style={{fontSize:12}}>
                  <tbody>
                    <tr><td style={{width:120, color:'var(--fg-2)'}}>Mode</td><td><Tag>{modeMeta.label}</Tag></td></tr>
                    <tr><td style={{color:'var(--fg-2)'}}>Provider</td><td>{providers.find(p=>p.id===providerId)?.name}</td></tr>
                    <tr><td style={{color:'var(--fg-2)'}}>Target</td><td className="mono xsmall">{target}</td></tr>
                    {prompt && <tr><td style={{color:'var(--fg-2)'}}>Prompt</td><td style={{fontSize:12}}>{prompt}</td></tr>}
                    {schema && <tr><td style={{color:'var(--fg-2)'}}>Schema</td><td className="mono xsmall">{schema}</td></tr>}
                    <tr><td style={{color:'var(--fg-2)'}}>Schedule</td><td>{schedule}</td></tr>
                    <tr><td style={{color:'var(--fg-2)'}}>Owner</td><td>{owner}</td></tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {err && (
            <div className="hstack" style={{marginTop:10, padding:'7px 10px', background:'oklch(0.32 0.10 28)', borderRadius:6, border:'1px solid var(--err-line)'}}>
              <I.AlertTriangle size={12} style={{color:'var(--err)'}}/>
              <span style={{fontSize:12, color:'var(--fg-0)'}}>{err}</span>
            </div>
          )}
        </div>

        <div className="modal-foot">
          {step>1 && <button className="btn" onClick={()=>setStep(s=>s-1)}><I.ArrowLeft size={12}/> Back</button>}
          <span className="spacer"/>
          <button className="btn" onClick={onClose}>Cancel</button>
          {step<4
            ? <button className="btn primary" onClick={next}>Next <I.ArrowRight size={12}/></button>
            : <button className="btn primary" onClick={create}><I.Activity size={12}/> {schedule==='one-off' ? 'Run now' : 'Create project'}</button>}
        </div>
      </div>
    </>
  );
}


/* ============================================================
   ADD PROVIDER MODAL
   ============================================================ */
function AddProviderModal({ onClose, onAdd }) {
  const templates = [
    { id:'firecrawl',   name:'Firecrawl',         type:'crawler', blurb:'LLM-friendly scrape/crawl/map/search/extract/watch.', fields:['apiKey','baseUrl'] },
    { id:'playwright',  name:'Playwright runner', type:'browser', blurb:'Self-hosted browser pool for precise actions.',       fields:['endpoint','poolSize'] },
    { id:'browserbase', name:'Browserbase',       type:'browser', blurb:'Managed headless browsers with stealth.',             fields:['apiKey','projectId'] },
    { id:'apify',       name:'Apify',             type:'scraper', blurb:'Marketplace actors for long-tail sites.',             fields:['apiToken'] },
    { id:'custom',      name:'Custom adapter',    type:'custom',  blurb:'Implement the Web-Ops adapter contract.',             fields:['name','webhookUrl','apiKey'] },
  ];
  const [picked, setPicked] = React.useState('firecrawl');
  const [values, setValues] = React.useState({});
  const [testing, setTesting] = React.useState(false);
  const [tested, setTested] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const t = templates.find(x => x.id===picked);

  const test = () => {
    setErr(null);
    const missing = t.fields.filter(f => !values[f]);
    if (missing.length) { setErr('Fill in: ' + missing.join(', ')); return; }
    setTesting(true); setTested(false);
    setTimeout(() => { setTesting(false); setTested(true); }, 1100);
  };

  const connect = () => {
    if (!tested) { test(); return; }
    onAdd({
      id: picked==='custom' ? (values.name||'custom').toLowerCase().replace(/\s+/g,'-') : picked,
      key: picked,
      name: picked==='custom' ? (values.name||'Custom adapter') : t.name,
      type: t.type,
      status:'healthy',
      version:'just added',
      region:'—',
      config:'user-supplied',
      lastTestAt:'just now',
      lastSyncAt:'—',
      error:null,
      capabilities:['connect'],
      modes:['session'],
    });
  };

  return (
    <>
      <div className="panel-overlay" onClick={onClose} style={{zIndex:210}}/>
      <div className="modal" style={{maxWidth:600, zIndex:211}}>
        <div className="modal-head">
          <div>
            <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--fg-2)', fontWeight:600}}>Web operations</div>
            <h3 style={{margin:'2px 0 0', fontSize:16, color:'var(--fg-0)'}}>Add provider</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><I.X size={14}/></button>
        </div>

        <div className="modal-body">
          <div className="stat-label" style={{marginBottom:6}}>Provider</div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6, marginBottom:14}}>
            {templates.map(tmpl => {
              const active = picked===tmpl.id;
              return (
                <div key={tmpl.id}
                  onClick={()=>{setPicked(tmpl.id); setValues({}); setTested(false); setErr(null);}}
                  style={{
                    padding:'8px 10px', borderRadius:6, cursor:'pointer',
                    background: active?'var(--accent-soft)':'var(--bg-2)',
                    border: `1px solid ${active?'var(--accent-line)':'var(--line-1)'}`,
                  }}>
                  <div style={{fontSize:13, color:'var(--fg-0)', fontWeight:500}}>{tmpl.name} <span className="muted xsmall">· {tmpl.type}</span></div>
                  <div className="muted xsmall truncate">{tmpl.blurb}</div>
                </div>
              );
            })}
          </div>

          <div className="stat-label" style={{marginBottom:6}}>Credentials</div>
          <div className="vstack" style={{gap:6}}>
            {t.fields.map(f => (
              <div key={f}>
                <label className="muted xsmall" style={{display:'block', marginBottom:2, fontFamily:'var(--mono)'}}>{f}</label>
                <input
                  className={f.toLowerCase().includes('key') || f.toLowerCase().includes('token') ? 'input mono xsmall' : 'input'}
                  style={{width:'100%'}}
                  type={f.toLowerCase().includes('key') || f.toLowerCase().includes('token') ? 'password' : 'text'}
                  placeholder={f==='apiKey'?'fc-live-••••••••':f==='endpoint'?'https://pw.ops.to-knowledge.com':''}
                  value={values[f]||''}
                  onChange={e=>{setValues({...values, [f]: e.target.value}); setTested(false);}}
                />
              </div>
            ))}
          </div>

          {tested && (
            <div className="hstack" style={{marginTop:10, padding:'8px 10px', background:'var(--accent-soft)', borderRadius:6, border:'1px solid var(--accent-line)'}}>
              <I.Check size={12} style={{color:'var(--accent)'}}/>
              <span style={{fontSize:12, color:'var(--fg-0)'}}>Connection test passed · latency 148ms · provider ready.</span>
            </div>
          )}

          {err && (
            <div className="hstack" style={{marginTop:10, padding:'7px 10px', background:'oklch(0.32 0.10 28)', borderRadius:6, border:'1px solid var(--err-line)'}}>
              <I.AlertTriangle size={12} style={{color:'var(--err)'}}/>
              <span style={{fontSize:12, color:'var(--fg-0)'}}>{err}</span>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <span className="muted xsmall">Stored in Settings → Integrations · secrets vaulted.</span>
          <span className="spacer"/>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={test} disabled={testing}>
            {testing ? <><I.Loader size={12}/> Testing…</> : <><I.Activity size={12}/> Test</>}
          </button>
          <button className="btn primary" onClick={connect}><I.Plug size={12}/> {tested?'Connect':'Test & connect'}</button>
        </div>
      </div>
    </>
  );
}


/* ============================================================
   REASSIGN / SWITCH-PROVIDER MINI MODAL
   ============================================================ */
function PickerModal({ title, options, onPick, onClose, renderOption }) {
  return (
    <>
      <div className="panel-overlay" onClick={onClose} style={{zIndex:210}}/>
      <div className="modal" style={{maxWidth:420, zIndex:211}}>
        <div className="modal-head">
          <h3 style={{margin:0, fontSize:15, color:'var(--fg-0)'}}>{title}</h3>
          <button className="icon-btn" onClick={onClose}><I.X size={14}/></button>
        </div>
        <div className="modal-body" style={{padding:6}}>
          <div className="vstack" style={{gap:0}}>
            {options.map((o, i) => (
              <div key={o.id||i}
                onClick={()=>onPick(o)}
                style={{padding:'10px 12px', borderRadius:6, cursor:'pointer'}}
                className="picker-row">
                {renderOption(o)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}


/* ============================================================
   DRILL-DOWN WORKSPACE
   ============================================================ */
function WebOpsDrawer({ onClose, initialTab }) {
  const [tab, setTab] = React.useState(initialTab || 'live');

  // Reactive state
  const [providers, setProviders] = React.useState(WEBOPS_PROVIDERS_SEED);
  const [sessions, setSessions]   = React.useState(WEBOPS_SESSIONS_SEED);
  const [events, setEvents]       = React.useState(WEBOPS_EVENTS_SEED);
  const [projects, setProjects]   = React.useState(WEBOPS_PROJECTS_SEED);

  const [selectedId, setSelectedId] = React.useState(WEBOPS_SESSIONS_SEED[0].id);
  const [filters, setFilters] = React.useState({ agent:'all', status:'all', provider:'all', project:'all' });

  // Modal state
  const [newOpen, setNewOpen] = React.useState(false);
  const [addProvOpen, setAddProvOpen] = React.useState(false);
  const [reassignOpen, setReassignOpen] = React.useState(false);
  const [switchProvOpen, setSwitchProvOpen] = React.useState(false);
  const [testingProviderId, setTestingProviderId] = React.useState(null);

  const { show: toast, node: toastNode } = useToast();

  const sel = sessions.find(s => s.id===selectedId) || sessions[0];
  const selProv = providers.find(p => p.id===sel?.providerId);

  const filtered = sessions.filter(s => {
    if (filters.agent!=='all' && s.agent.toLowerCase()!==filters.agent) return false;
    if (filters.status!=='all' && s.status!==filters.status) return false;
    if (filters.provider!=='all' && s.providerId!==filters.provider) return false;
    if (filters.project!=='all' && s.project!==filters.project) return false;
    return true;
  });

  const agents = [...new Set(sessions.map(s => s.agent.toLowerCase()))];

  const nowTime = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  };

  const logEvent = (sessionId, agent, kind, human) => {
    setEvents(prev => [{ t: nowTime(), sessionId, agent, kind, human }, ...prev]);
  };

  // ============================================================
  // Session action handlers
  // ============================================================
  const updateSession = (id, patch, event) => {
    setSessions(prev => prev.map(s => s.id===id ? {...s, ...patch} : s));
    const s = sessions.find(x => x.id===id);
    if (s && event) logEvent(id, s.agent, event.kind, event.human);
  };

  const handlePause = () => {
    const paused = sel.status==='paused' || sel.status==='complete' || sel.status==='failed';
    if (paused && sel.status==='paused') {
      updateSession(sel.id, { status:'navigating' }, { kind:'resume', human:`${sel.agent} resumed the session on ${sel.domain}.` });
      toast(`Resumed ${sel.agent} on ${sel.domain}`);
    } else {
      updateSession(sel.id, { status:'paused' }, { kind:'pause', human:`${sel.agent} paused the session on ${sel.domain}.` });
      toast(`Paused ${sel.agent}`, 'warn');
    }
  };

  const handleRetry = () => {
    updateSession(sel.id, { status:'navigating', errors:0, warnings:Math.max(0, sel.warnings-1) },
      { kind:'retry', human:`${sel.agent} restarted the session with a fresh context.` });
    toast(`Retrying ${sel.id} with a fresh session`);
  };

  const handleStop = () => {
    updateSession(sel.id, { status:'complete' }, { kind:'stop', human:`${sel.agent} stopped the session manually.` });
    toast(`Stopped ${sel.id}`, 'warn');
  };

  const handleExport = () => {
    toast(`Export queued · ${sel.id} trail.json downloading…`);
    logEvent(sel.id, sel.agent, 'export', `Activity trail for ${sel.id} exported as JSON (${sel.pages}p · ${sel.actions}a · ${sel.extracted}x).`);
  };

  const handleReassign = (agentName) => {
    updateSession(sel.id, { agent: agentName },
      { kind:'reassign', human:`Session reassigned from ${sel.agent} to ${agentName}.` });
    toast(`Reassigned to ${agentName}`);
    setReassignOpen(false);
  };

  const handleSwitchProvider = (providerId) => {
    const newProv = providers.find(p => p.id===providerId);
    updateSession(sel.id, { providerId, tool: `${providerId}.${sel.tool.split('.')[1]||'action'}` },
      { kind:'switch', human:`Provider switched to ${newProv.name}. Re-initializing session…` });
    toast(`Switched to ${newProv.name}`);
    setSwitchProvOpen(false);
  };

  const handleOpenUrl = () => {
    window.open(sel.url, '_blank', 'noopener,noreferrer');
  };

  // ============================================================
  // Provider handlers
  // ============================================================
  const handleTestProvider = (p) => {
    setTestingProviderId(p.id);
    setTimeout(() => {
      setProviders(prev => prev.map(x => x.id===p.id
        ? {...x, lastTestAt:'just now', status: x.status==='offline'?'healthy':x.status, error: x.status==='offline'?null:x.error}
        : x));
      setTestingProviderId(null);
      toast(`${p.name} · connection OK (148ms)`);
    }, 900);
  };

  // Honest: neither the reconnect nor the connect action reaches a real
  // provider. We record the attempt and tell the operator the truth
  // instead of flipping the pill to green.
  const handleReconnect = (p) => {
    setTestingProviderId(p.id);
    setTimeout(() => {
      setTestingProviderId(null);
      toast(`${p.name} · reconnect not wired — POST /api/webops/providers/${p.id}/reconnect`);
    }, 350);
  };

  const handleConnect = (p) => {
    setTestingProviderId(p.id);
    setTimeout(() => {
      setTestingProviderId(null);
      toast(`${p.name} · connect not wired — needs vault + POST /api/webops/providers/${p.id}/connect`);
    }, 350);
  };

  const handleAddProvider = (p) => {
    setProviders(prev => [...prev.filter(x => x.id!==p.id), p]);
    setAddProvOpen(false);
    toast(`${p.name} added · healthy`);
  };

  // ============================================================
  // New project
  // ============================================================
  const handleCreateProject = (proj) => {
    setProjects(prev => [proj, ...prev]);
    // If one-off, also spawn a session
    if (proj.schedule==='one-off') {
      const newSession = {
        id: 'WS-' + Math.floor(Math.random()*9000+1000),
        providerId: proj.providerId,
        agent: proj.owner,
        project: proj.name,
        task: proj.prompt,
        domain: (proj.target.match(/https?:\/\/([^\/]+)/)||['',proj.target])[1],
        url: proj.target,
        status: 'navigating',
        started: nowTime().slice(0,5),
        duration: '0m 02s',
        skill: 'web-research',
        model: 'sonnet-4.5',
        tool: `${proj.providerId}.${proj.mode}`,
        pages: 0, actions: 0, extracted: 0, warnings: 0, errors: 0,
        summary: `${proj.owner} started a ${proj.mode} against ${proj.target}.`,
      };
      setSessions(prev => [newSession, ...prev]);
      logEvent(newSession.id, proj.owner, 'start', `${proj.owner} started a ${proj.mode} session against ${proj.target}.`);
      setSelectedId(newSession.id);
      setTab('live');
      toast(`Running now · ${proj.name}`);
    } else {
      toast(`Scheduled · ${proj.name}`);
      setTab('projects');
    }
    setNewOpen(false);
  };

  const handleRunProject = (proj) => {
    const newSession = {
      id: 'WS-' + Math.floor(Math.random()*9000+1000),
      providerId: proj.providerId,
      agent: proj.owner,
      project: proj.name,
      task: proj.prompt || proj.name,
      domain: (proj.target.match(/https?:\/\/([^\/]+)/)||['',proj.target])[1],
      url: proj.target,
      status: 'navigating',
      started: nowTime().slice(0,5),
      duration: '0m 02s',
      skill: 'web-research',
      model: 'sonnet-4.5',
      tool: `${proj.providerId}.${proj.mode}`,
      pages: 0, actions: 0, extracted: 0, warnings: 0, errors: 0,
      summary: `${proj.owner} re-ran "${proj.name}".`,
    };
    setSessions(prev => [newSession, ...prev]);
    setProjects(prev => prev.map(p => p.id===proj.id ? {...p, lastRun:'just now', runs:p.runs+1, status:'running'} : p));
    logEvent(newSession.id, proj.owner, 'start', `Manual run of "${proj.name}" against ${proj.target}.`);
    toast(`Running · ${proj.name}`);
    setSelectedId(newSession.id);
    setTab('live');
  };

  const handleToggleProjectPause = (proj) => {
    const paused = proj.status==='paused';
    setProjects(prev => prev.map(p => p.id===proj.id ? {...p, status: paused ? 'scheduled' : 'paused', nextRun: paused ? p.nextRun : '—'} : p));
    toast(paused ? `Resumed · ${proj.name}` : `Paused · ${proj.name}`, paused?'ok':'warn');
  };

  const REASSIGN_AGENTS = ['Agent Zero','Hermes','Atlas','Orion','Lyra','Research','Isaac'].filter(a => a!==sel?.agent);

  return (
    <WorkspaceOverlay
      title="Web operations"
      subtitle="Agent site navigation · Firecrawl + extensible providers"
      onClose={onClose}
      wide
    >
      {/* Header KPI row */}
      <div className="dash-grid" style={{marginBottom:14}}>
        <div className="card col-3"><div className="card-body vstack">
          <div className="stat-label">Active sessions</div>
          <div className="mono" style={{fontSize:20, color:'var(--accent)'}}>{sessions.filter(s => !['complete','failed'].includes(s.status)).length}</div>
          <div className="muted xsmall">{sessions.length} today</div>
        </div></div>
        <div className="card col-3"><div className="card-body vstack">
          <div className="stat-label">Providers</div>
          <div className="mono" style={{fontSize:20, color:'var(--fg-0)'}}>{providers.filter(p => p.status==='healthy').length}<span className="muted" style={{fontSize:13}}> /{providers.length}</span></div>
          <div className="muted xsmall">{providers.filter(p => p.status==='degraded').length} degraded · {providers.filter(p => p.status==='offline').length} offline</div>
        </div></div>
        <div className="card col-3"><div className="card-body vstack">
          <div className="stat-label">Pages · actions</div>
          <div className="mono" style={{fontSize:18, color:'var(--fg-0)'}}>
            {sessions.reduce((a,s)=>a+s.pages,0)} <span style={{color:'var(--fg-2)'}}>·</span> {sessions.reduce((a,s)=>a+s.actions,0)}
          </div>
          <div className="muted xsmall">extracted {sessions.reduce((a,s)=>a+s.extracted,0)}</div>
        </div></div>
        <div className="card col-3"><div className="card-body vstack">
          <div className="stat-label">Warnings · errors</div>
          <div className="mono" style={{fontSize:18}}>
            <span style={{color:'var(--warn)'}}>{sessions.reduce((a,s)=>a+s.warnings,0)}</span>
            <span style={{color:'var(--fg-2)'}}> · </span>
            <span style={{color:'var(--err)'}}>{sessions.reduce((a,s)=>a+s.errors,0)}</span>
          </div>
          <div className="muted xsmall">last 24h</div>
        </div></div>
      </div>

      {/* Knowledge sync ribbon */}
      <div className="card" style={{marginBottom:14}}>
        <div className="card-head">
          <div className="card-title"><I.Activity/> Knowledge sync</div>
          <span className="muted xsmall">findings flow into shared memory automatically</span>
        </div>
        <div className="card-body">
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8}}>
            <BrainPill icon={<I.Book size={14} style={{color:'var(--accent)'}}/>}     label="Obsidian"   s={BRAIN_SYNC.obsidian.status}  last={BRAIN_SYNC.obsidian.last}  note={BRAIN_SYNC.obsidian.note}/>
            <BrainPill icon={<I.Database size={14} style={{color:'var(--accent)'}}/>} label="MemPalace"  s={BRAIN_SYNC.mempalace.status} last={BRAIN_SYNC.mempalace.last} note={BRAIN_SYNC.mempalace.note}/>
            <BrainPill icon={<GraphGlyph size={14}/>}                                 label="Graphify"   s={BRAIN_SYNC.graphify.status}  last={BRAIN_SYNC.graphify.last}  note={BRAIN_SYNC.graphify.note}/>
            <BrainPill icon={<PacmanGlyph size={14}/>}                                label="Pac-Man"    s={BRAIN_SYNC.pacman.status}    last={BRAIN_SYNC.pacman.last}    note={BRAIN_SYNC.pacman.note}/>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="hstack" style={{marginBottom:12}}>
        <ButtonGroup value={tab} onChange={setTab} options={[
          {value:'live',      label:'Live sessions', count: sessions.length},
          {value:'projects',  label:'Projects',      count: projects.length},
          {value:'events',    label:'Activity feed', count: events.length},
          {value:'providers', label:'Providers',     count: providers.length},
          {value:'usage',     label:'Agent runtime', count: sessions.length},
        ]}/>
        <span className="spacer"/>
        <button className="btn" onClick={()=>setAddProvOpen(true)}><I.Plus size={12}/> Add provider</button>
        <button className="btn primary" onClick={()=>setNewOpen(true)}><I.Plus size={12}/> New project</button>
      </div>

      {/* LIVE SESSIONS */}
      {tab==='live' && (
        <div className="dash-grid">
          {/* session list */}
          <div className="card col-5">
            <div className="card-head">
              <div className="card-title">Sessions <span className="card-subtitle">{filtered.length}</span></div>
            </div>
            <div className="card-body vstack" style={{gap:0, padding:0}}>
              <div className="hstack" style={{padding:'8px 10px', gap:6, borderBottom:'1px solid var(--line-1)'}}>
                <select className="select" value={filters.agent} onChange={e=>setFilters({...filters, agent:e.target.value})} style={{flex:1}}>
                  <option value="all">All agents</option>
                  {agents.map(a => <option key={a} value={a}>{a[0].toUpperCase()+a.slice(1)}</option>)}
                </select>
                <select className="select" value={filters.status} onChange={e=>setFilters({...filters, status:e.target.value})} style={{flex:1}}>
                  <option value="all">Any status</option>
                  {['navigating','extracting','submitting','warning','blocked','paused','complete','failed'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="select" value={filters.provider} onChange={e=>setFilters({...filters, provider:e.target.value})} style={{flex:1}}>
                  <option value="all">Any provider</option>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{maxHeight:560, overflow:'auto'}}>
                {filtered.map(s => {
                  const prov = providers.find(p => p.id===s.providerId);
                  const selected = s.id===selectedId;
                  return (
                    <div key={s.id}
                      onClick={()=>setSelectedId(s.id)}
                      style={{
                        padding:'10px 12px',
                        borderBottom:'1px solid var(--line-1)',
                        background: selected ? 'var(--accent-soft)' : 'transparent',
                        borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
                        cursor:'pointer',
                      }}>
                      <div className="hstack" style={{marginBottom:4}}>
                        <Avatar name={s.agent} size={20}/>
                        <span style={{color:'var(--fg-0)', fontSize:13, fontWeight:500}}>{s.agent}</span>
                        <span className="spacer"/>
                        <span className="status-pill">
                          <StatusDot s={webopsStatusKind(s.status)}/>
                          <span>{s.status}</span>
                        </span>
                      </div>
                      <div className="mono xsmall" style={{color:'var(--fg-1)'}} title={s.url}>{s.domain}</div>
                      <div className="muted xsmall truncate">{s.task}</div>
                      <div className="hstack" style={{marginTop:4}}>
                        <span className="tag xsmall">{prov?.name}</span>
                        <span className="mono xsmall muted">{s.duration}</span>
                        <span className="spacer"/>
                        <span className="mono xsmall muted">{s.pages}p · {s.actions}a · {s.extracted}x</span>
                      </div>
                    </div>
                  );
                })}
                {filtered.length===0 && (
                  <div className="muted xsmall" style={{padding:'30px 12px', textAlign:'center'}}>No sessions match these filters.</div>
                )}
              </div>
            </div>
          </div>

          {/* selected session detail */}
          {sel && (
            <div className="card col-7">
              <div className="card-head">
                <div className="card-title hstack">
                  <Avatar name={sel.agent} size={22}/>
                  <span>{sel.agent}</span>
                  <span className="card-subtitle">{sel.id} · {selProv?.name}</span>
                </div>
                <span className="status-pill">
                  <StatusDot s={webopsStatusKind(sel.status)}/>
                  <span>{sel.status}</span>
                </span>
              </div>
              <div className="card-body vstack">
                <div className="hstack" style={{padding:'9px 11px', background:'var(--accent-soft)', borderRadius:8, border:'1px solid var(--accent-line)', gap:10}}>
                  <I.Sparkle size={14} style={{color:'var(--accent)', flexShrink:0}}/>
                  <span style={{fontSize:12, color:'var(--fg-0)', lineHeight:1.45}}>{sel.summary}</span>
                </div>

                <WebOpsPreview session={sel}/>

                <div className="hstack" style={{padding:'7px 10px', background:'var(--bg-2)', borderRadius:6, border:'1px solid var(--line-1)'}}>
                  <I.Globe size={12} style={{color:'var(--fg-2)'}}/>
                  <span className="mono xsmall" style={{color:'var(--fg-1)', flex:1, minWidth:0}} title={sel.url}>{sel.url}</span>
                  <button className="btn sm" onClick={handleOpenUrl} title="Open target URL in a new tab"><I.External size={11}/></button>
                </div>

                {/* session action bar — NOW WIRED */}
                <div className="hstack" style={{flexWrap:'wrap'}}>
                  <button className="btn sm" onClick={handlePause}>
                    {sel.status==='paused' ? <><I.Play size={11}/> Resume</> : <><I.Pause size={11}/> Pause</>}
                  </button>
                  <button className="btn sm" onClick={handleRetry}><I.Refresh size={11}/> Retry</button>
                  <button className="btn sm" onClick={handleStop}><I.X size={11}/> Stop</button>
                  <button className="btn sm" onClick={()=>setReassignOpen(true)}><I.Users size={11}/> Reassign</button>
                  <span className="spacer"/>
                  <button className="btn sm" onClick={()=>setSwitchProvOpen(true)}><I.Plug size={11}/> Switch provider</button>
                  <button className="btn sm" onClick={handleExport}><I.Download size={11}/> Export trail</button>
                </div>

                <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8}}>
                  <div style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
                    <div className="stat-label">Time spent</div>
                    <div className="mono" style={{fontSize:16, color:'var(--fg-0)'}}>{sel.duration}</div>
                  </div>
                  <div style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
                    <div className="stat-label">Pages · actions</div>
                    <div className="mono" style={{fontSize:16, color:'var(--fg-0)'}}>{sel.pages} · {sel.actions}</div>
                  </div>
                  <div style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
                    <div className="stat-label">Extracted</div>
                    <div className="mono" style={{fontSize:16, color:'var(--accent)'}}>{sel.extracted}</div>
                  </div>
                  <div style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
                    <div className="stat-label">Warn · err</div>
                    <div className="mono" style={{fontSize:16}}>
                      <span style={{color: sel.warnings>0?'var(--warn)':'var(--fg-2)'}}>{sel.warnings}</span>
                      <span style={{color:'var(--fg-2)'}}> · </span>
                      <span style={{color: sel.errors>0?'var(--err)':'var(--fg-2)'}}>{sel.errors}</span>
                    </div>
                  </div>
                </div>

                <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8}}>
                  <div style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
                    <div className="stat-label">Skill</div>
                    <div style={{fontSize:13, color:'var(--fg-0)'}}>{sel.skill}</div>
                  </div>
                  <div style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
                    <div className="stat-label">Tool</div>
                    <div className="mono" style={{fontSize:12, color:'var(--fg-1)'}}>{sel.tool}</div>
                  </div>
                  <div style={{padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--line-1)'}}>
                    <div className="stat-label">Model</div>
                    <div className="mono" style={{fontSize:12, color:'var(--fg-1)'}}>{sel.model}</div>
                  </div>
                </div>

                <div>
                  <div className="stat-label" style={{marginBottom:6}}>Activity trail · plain language</div>
                  <div className="vstack" style={{gap:0}}>
                    {events.filter(e => e.sessionId===sel.id).map((e,i)=>(
                      <div key={i} className="hive-row" style={{padding:'8px 0'}}>
                        <div style={{width:54, flexShrink:0}} className="mono xsmall muted">{e.t}</div>
                        <span className={`tag xsmall ${e.kind==='error'?'err':e.kind==='warning'||e.kind==='blocked'?'warn':''}`}>{e.kind}</span>
                        <span style={{flex:1, minWidth:0, fontSize:12, color:'var(--fg-0)'}}>{e.human}</span>
                      </div>
                    ))}
                    {events.filter(e => e.sessionId===sel.id).length===0 && (
                      <div className="muted xsmall" style={{padding:'10px 0'}}>No events recorded for this session yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PROJECTS */}
      {tab==='projects' && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">Projects & watches</div>
            <span className="muted xsmall">scheduled, on-demand, and watched web tasks</span>
          </div>
          <table className="tbl">
            <thead><tr>
              <th style={{width:90}}>ID</th>
              <th>Name</th>
              <th style={{width:90}}>Mode</th>
              <th style={{width:130}}>Provider</th>
              <th style={{width:100}}>Schedule</th>
              <th style={{width:100}}>Next run</th>
              <th style={{width:90}}>Runs</th>
              <th style={{width:110}}>Status</th>
              <th style={{width:220}}>Actions</th>
            </tr></thead>
            <tbody>
              {projects.map(p => {
                const prov = providers.find(x => x.id===p.providerId);
                const paused = p.status==='paused';
                return (
                  <tr key={p.id}>
                    <td className="mono xsmall muted">{p.id}</td>
                    <td>
                      <div style={{color:'var(--fg-0)', fontSize:13, fontWeight:500}}>{p.name}</div>
                      <div className="mono xsmall muted truncate" title={p.target} style={{maxWidth:380}}>{p.target}</div>
                    </td>
                    <td><Tag>{p.mode}</Tag></td>
                    <td><span className="tag xsmall">{prov?.name || p.providerId}</span></td>
                    <td className="mono xsmall muted">{p.schedule}</td>
                    <td className="mono xsmall" style={{color:'var(--fg-1)'}}>{p.nextRun}</td>
                    <td className="mono">{p.runs}</td>
                    <td>
                      <span className="status-pill">
                        <StatusDot s={webopsStatusKind(p.status)}/>
                        <span>{p.status}</span>
                      </span>
                    </td>
                    <td>
                      <div className="hstack" style={{gap:4}}>
                        <button className="btn sm" onClick={()=>handleRunProject(p)}><I.Play size={11}/> Run</button>
                        <button className="btn sm" onClick={()=>handleToggleProjectPause(p)}>
                          {paused ? <><I.Play size={11}/> Resume</> : <><I.Pause size={11}/> Pause</>}
                        </button>
                        <button className="btn sm" onClick={()=>toast(`Editing ${p.id} …`)}><I.Edit size={11}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="card-body" style={{borderTop:'1px solid var(--line-1)'}}>
            <div className="hstack" style={{gap:10}}>
              <I.Info size={14} style={{color:'var(--accent)'}}/>
              <span style={{fontSize:12, color:'var(--fg-1)', flex:1}}>
                Projects map 1:1 to Firecrawl modes — <b style={{color:'var(--fg-0)'}}>scrape, crawl, map, search, extract, watch</b> — and to generic "session" jobs on browser providers.
              </span>
              <button className="btn primary" onClick={()=>setNewOpen(true)}><I.Plus size={12}/> New project</button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVITY FEED */}
      {tab==='events' && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">Cross-session activity</div>
            <span className="muted xsmall">plain-language events across all providers</span>
          </div>
          <table className="tbl">
            <thead><tr>
              <th style={{width:100}}>Time</th>
              <th style={{width:100}}>Session</th>
              <th style={{width:140}}>Agent</th>
              <th style={{width:110}}>Kind</th>
              <th>What happened</th>
            </tr></thead>
            <tbody>
              {events.map((e,i)=>{
                const s = sessions.find(x => x.id===e.sessionId);
                return (
                  <tr key={i} onClick={()=>{setTab('live'); setSelectedId(e.sessionId);}} style={{cursor:'pointer'}}>
                    <td className="mono xsmall muted">{e.t}</td>
                    <td className="mono xsmall" style={{color:'var(--fg-1)'}}>{e.sessionId}</td>
                    <td><span className="hstack"><Avatar name={e.agent} size={18}/><span style={{color:'var(--fg-0)'}}>{e.agent}</span></span></td>
                    <td>
                      <span className={`tag ${e.kind==='error'?'err':e.kind==='warning'||e.kind==='blocked'?'warn':''}`}>{e.kind}</span>
                    </td>
                    <td style={{fontSize:12, color:'var(--fg-0)'}}>{e.human} {s && <span className="muted xsmall">· {s.domain}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* PROVIDERS */}
      {tab==='providers' && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">Provider adapters</div>
            <span className="muted xsmall">unified contract: connect · status · start/stop · events · metrics · test</span>
          </div>
          <table className="tbl">
            <thead><tr>
              <th style={{width:170}}>Provider</th>
              <th style={{width:100}}>Type</th>
              <th style={{width:110}}>Status</th>
              <th style={{width:90}}>Version</th>
              <th style={{width:110}}>Region</th>
              <th>Capabilities</th>
              <th style={{width:120}}>Last test</th>
              <th style={{width:200}}>Actions</th>
            </tr></thead>
            <tbody>
              {providers.map(p => {
                const testing = testingProviderId===p.id;
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{color:'var(--fg-0)', fontSize:13, fontWeight:500}}>{p.name}</div>
                      <div className="mono xsmall muted">{p.config}</div>
                    </td>
                    <td><Tag>{p.type}</Tag></td>
                    <td>
                      <span className="status-pill">
                        <StatusDot s={webopsStatusKind(p.status)}/>
                        <span style={{textTransform:'capitalize'}}>{p.status}</span>
                      </span>
                      {p.error && <div className="muted xsmall" style={{marginTop:2}}>{p.error}</div>}
                    </td>
                    <td className="mono xsmall muted">{p.version}</td>
                    <td className="mono xsmall muted">{p.region}</td>
                    <td>
                      <div className="filter-row" style={{gap:4}}>
                        {p.capabilities.length===0
                          ? <span className="muted xsmall">—</span>
                          : p.capabilities.map(c => <span key={c} className="tag xsmall">{c}</span>)}
                      </div>
                    </td>
                    <td className="mono xsmall muted">{p.lastTestAt}</td>
                    <td>
                      <div className="hstack" style={{gap:4}}>
                        <button className="btn sm" onClick={()=>handleTestProvider(p)} disabled={testing}>
                          {testing ? <><I.Loader size={11}/> Testing…</> : <><I.Activity size={11}/> Test</>}
                        </button>
                        {p.status==='offline'
                          ? <button className="btn primary sm" onClick={()=>handleConnect(p)} disabled={testing}>
                              {testing ? <I.Loader size={11}/> : <I.Plug size={11}/>} Connect
                            </button>
                          : <button className="btn sm" onClick={()=>handleReconnect(p)} disabled={testing}>
                              {testing ? <I.Loader size={11}/> : <I.Refresh size={11}/>} Reconnect
                            </button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="card-body" style={{borderTop:'1px solid var(--line-1)'}}>
            <div className="hstack" style={{gap:10}}>
              <I.Plug size={14} style={{color:'var(--accent)'}}/>
              <span style={{fontSize:12, color:'var(--fg-1)', flex:1}}>
                <b style={{color:'var(--fg-0)'}}>Extensible by design.</b> Every provider implements the same adapter contract —
                <span className="mono xsmall" style={{color:'var(--fg-2)'}}> connect · status · start_session · stop_session · fetch_events · fetch_metrics · fetch_artifacts · test_connection</span>.
                Register new vendors through Settings → Integrations without touching the dashboard.
              </span>
              <button className="btn" onClick={()=>setAddProvOpen(true)}><I.Plus size={12}/> Add provider</button>
            </div>
          </div>
        </div>
      )}

      {/* AGENT RUNTIME USAGE */}
      {tab==='usage' && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">Agent runtime usage · per session</div>
            <span className="muted xsmall">who · time · skill · tool · model · project/task</span>
          </div>
          <table className="tbl">
            <thead><tr>
              <th style={{width:100}}>Session</th>
              <th style={{width:140}}>Agent</th>
              <th>Project / Task</th>
              <th style={{width:100}}>Time</th>
              <th style={{width:140}}>Skill</th>
              <th style={{width:160}}>Tool</th>
              <th style={{width:120}}>Model</th>
              <th style={{width:120}}>Provider</th>
            </tr></thead>
            <tbody>
              {sessions.map(s => {
                const prov = providers.find(p => p.id===s.providerId);
                return (
                  <tr key={s.id} onClick={()=>{setTab('live'); setSelectedId(s.id);}} style={{cursor:'pointer'}}>
                    <td className="mono xsmall muted">{s.id}</td>
                    <td><span className="hstack"><Avatar name={s.agent} size={20}/><span style={{color:'var(--fg-0)'}}>{s.agent}</span></span></td>
                    <td>
                      <div style={{color:'var(--fg-0)', fontSize:12}}>{s.project}</div>
                      <div className="muted xsmall">{s.task}</div>
                    </td>
                    <td className="mono">{s.duration}</td>
                    <td><Tag>{s.skill}</Tag></td>
                    <td className="mono xsmall" style={{color:'var(--fg-1)'}}>{s.tool}</td>
                    <td className="mono xsmall muted">{s.model}</td>
                    <td><span className="tag xsmall">{prov?.name}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODALS */}
      {newOpen && (
        <NewWebOpsProjectModal
          onClose={()=>setNewOpen(false)}
          onCreate={handleCreateProject}
          providers={providers}
        />
      )}
      {addProvOpen && (
        <AddProviderModal
          onClose={()=>setAddProvOpen(false)}
          onAdd={handleAddProvider}
        />
      )}
      {reassignOpen && sel && (
        <PickerModal
          title={`Reassign ${sel.id}`}
          options={REASSIGN_AGENTS.map(name => ({ id:name, name }))}
          onClose={()=>setReassignOpen(false)}
          onPick={(o)=>handleReassign(o.name)}
          renderOption={(o)=>(
            <div className="hstack">
              <Avatar name={o.name} size={22}/>
              <span style={{color:'var(--fg-0)', fontSize:13, fontWeight:500}}>{o.name}</span>
              <span className="spacer"/>
              <I.ArrowRight size={12} style={{color:'var(--fg-2)'}}/>
            </div>
          )}
        />
      )}
      {switchProvOpen && sel && (
        <PickerModal
          title={`Switch provider for ${sel.id}`}
          options={providers.filter(p => p.status!=='offline' && p.id!==sel.providerId)}
          onClose={()=>setSwitchProvOpen(false)}
          onPick={(o)=>handleSwitchProvider(o.id)}
          renderOption={(p)=>(
            <div className="hstack">
              <StatusDot s={webopsStatusKind(p.status)}/>
              <div style={{flex:1}}>
                <div style={{color:'var(--fg-0)', fontSize:13, fontWeight:500}}>{p.name}</div>
                <div className="muted xsmall">{p.type} · {p.version} · {p.region}</div>
              </div>
              <I.ArrowRight size={12} style={{color:'var(--fg-2)'}}/>
            </div>
          )}
        />
      )}

      {toastNode}
    </WorkspaceOverlay>
  );
}


Object.assign(window, {
  WEBOPS_PROVIDERS, WEBOPS_SESSIONS, WEBOPS_EVENTS, WEBOPS_MODES, WEBOPS_PROJECTS_SEED,
  WebOpsCard, WebOpsDrawer, WebOpsPreview,
  NewWebOpsProjectModal, AddProviderModal,
});
