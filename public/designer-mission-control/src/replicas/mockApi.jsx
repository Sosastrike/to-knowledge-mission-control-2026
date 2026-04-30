// ============================================================
// mockApi.jsx — façade over window.api.email + in-memory graph/source stubs.
//
// ⚡ EMAIL/SMTP MIGRATION (Priority 1)
//   The email surface (profiles, addresses, routing, test-send) is now
//   backed by the real backend layer: schema → adapter-local → api-client,
//   with permission guards + audit events. This file is kept ONLY so
//   existing callers (EmailProfilesPage.jsx) work unchanged — every
//   method here is a one-liner that delegates to window.api.email.*.
//
//   When the real HTTP adapter is installed (API_ADAPTER), the email
//   surface automatically uses it. No change required here.
//
// The graph / source / brain-pulse helpers BELOW the divider remain
// mocked in-memory — not in Priority 1 scope.
// ============================================================

function _api(){
  // window.api is defined by src/backend/api-client.jsx; load order is enforced
  // in Mission Control.html but we guard anyway with a clear error.
  if (!window.api || !window.api.email) {
    throw new Error('window.api.email not loaded — check script order in Mission Control.html');
  }
  return window.api.email;
}

// Provider catalog is static — proxy through to the api-client for a single source of truth.
const PROVIDERS_PROXY = new Proxy({}, {
  get(_t, key){ return _api().PROVIDERS[key]; },
  ownKeys(){ return Object.keys(_api().PROVIDERS); },
  getOwnPropertyDescriptor(){ return { enumerable: true, configurable: true }; },
});

// Honest wiring map for UI hints. Real endpoints now exist for everything
// except testSend (fake until SMTP service is live) and verifyAddress (needs DNS probe).
const API_WIRED = {
  profiles: true,          // api.email.{list,add,update,delete}Profile
  addresses: true,         // api.email.{list,add}Address
  routing: true,           // api.email.{list,update}Routing
  testSend: false,         // simulated — real SMTP send pending
  verifyAddress: false,    // simulated — DNS/DKIM probe pending
  graphSummary: false,     // numbers are mocked
  graphNodes: false,       // node-detail fetch NOT implemented
  brainPulses: false,      // simulated random walk
};

// ─── Subscriber pattern — forward adapter events ─────────
const _subs = new Set();
function _notify(){ _subs.forEach(fn => fn()); }
function subscribe(fn){
  _subs.add(fn);
  // Also subscribe to the adapter so mutations through api.email land here.
  const unsubAdapter = window.apiSubscribe ? window.apiSubscribe(_notify) : () => {};
  return () => { _subs.delete(fn); unsubAdapter(); };
}

// ─── Email façade — delegate to api.email.* ─────────────
async function listProfiles(){        return _api().listProfiles(); }
async function addProfile(payload){   const r = await _api().addProfile(payload); _notify(); return r; }
async function updateProfile(id, p){  const r = await _api().updateProfile(id, p); _notify(); return r; }
async function rotateCredentials(id){ const r = await _api().rotateCredentials(id); _notify(); return r; }
async function deleteProfile(id){     const r = await _api().deleteProfile(id); _notify(); return r; }
async function testSend(id){          const r = await _api().testSend(id); _notify(); return r; }
async function testAll(){             const r = await _api().testAll();   _notify(); return r; }
async function listAddresses(){       return _api().listAddresses(); }
async function addAddress(payload){   const r = await _api().addAddress(payload); _notify(); return r; }
async function verifyAddress(id){     const r = await _api().verifyAddress(id); _notify(); return r; }
async function listRouting(){         return _api().listRouting(); }
async function updateRouting(id, p){  const r = await _api().updateRouting(id, p); _notify(); return r; }

// ─── Graph ──────────────────────────────────────────────
// Still in-memory — not in Priority 1 scope.
async function getGraphSummary(){
  return {
    nodes: 1_240_000, edges: 8_740_000, communities: 98,
    pulses_per_min: 2847, sync_health_pct: 98,
    last_update: 'just now',
  };
}
async function listCommunities(){
  return [
    { id:'c_know', name:'Knowledge Systems',     count:98431, color:'#38bdf8' },
    { id:'c_note', name:'Personal Notes',        count:87112, color:'#a78bfa' },
    { id:'c_proj', name:'Projects & Goals',      count:76884, color:'#fb7185' },
    { id:'c_ppl',  name:'People & Relationships',count:64320, color:'#e879f9' },
    { id:'c_res',  name:'Research & Learning',   count:61987, color:'#34d399' },
    { id:'c_idea', name:'Ideas & Concepts',      count:58431, color:'#fbbf24' },
  ];
}
async function getSource(name){
  const sources = {
    obsidian:  { label:'Obsidian',  status:'live', files:12431,   last:'2m ago'  },
    mempalace: { label:'MemPalace', status:'live', memories:7842, last:'1m ago'  },
    graphify:  { label:'Graphify',  status:'live', entities:1_180_000, last:'30s ago' },
    pacman:    { label:'Pac-Man',   status:'live', note:'Real-time events', last:'now' },
  };
  return sources[name] || null;
}

// ─── Brain sync pulse stream (simulated websocket) ──────────────
function streamBrainPulses(onTick){
  let base = 2847;
  const iv = setInterval(() => {
    base += Math.round((Math.random() - 0.5) * 40);
    base = Math.max(2400, Math.min(3200, base));
    onTick({ pulses_per_min: base, ts: Date.now() });
  }, 1200);
  return () => clearInterval(iv);
}

// ─── Expose ─────────────────────────────────────────────
window.MockApi = {
  API_WIRED,
  get PROVIDERS(){ return _api().PROVIDERS; },
  subscribe,
  listProfiles, addProfile, updateProfile, rotateCredentials, deleteProfile, testSend, testAll,
  listAddresses, addAddress, verifyAddress,
  listRouting, updateRouting,
  getGraphSummary, listCommunities, getSource,
  streamBrainPulses,
};
