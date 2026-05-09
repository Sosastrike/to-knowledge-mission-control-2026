/* Shared rendering primitives for Gateway design files.
   Loaded after gateway-data.js. Uses no frameworks. */

window.GW = (function () {
  const G = window.GATEWAY;

  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v === null || v === undefined) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      e.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return e;
  }

  function statusPill(status, label) {
    const text = label || G.STATUS[status]?.label || status;
    return el('span', { class: `pill ${status}` }, el('span', { class: 'dot' }), text);
  }

  function rwx(node) {
    return el('div', { class: 'rwx', title: 'Read · Write · Execute' },
      el('span', { class: `rwx-pill r ${node.R ? 'on' : ''}` }, 'R'),
      el('span', { class: `rwx-pill w ${node.W ? 'on' : ''}` }, 'W'),
      el('span', { class: `rwx-pill x ${node.X ? 'on' : ''}` }, 'X'),
    );
  }

  function lockBadge() {
    return el('span', { class: 'bridge-lock', title: 'Requires Bridge Session', html:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
    });
  }

  /* ---- Node card ---- */
  function nodeCard(node, opts = {}) {
    const card = el('div', { class: `node-card status-${node.status} type-${node.type}`, 'data-id': node.id, 'data-status': node.status });
    const head = el('div', { class: 'nc-head' });
    head.appendChild(el('div', { class: 'nc-dot', style: { background: G.statusColor(node.status) } }));
    head.appendChild(el('div', { class: 'nc-name' }, node.name));
    if (node.bridge) head.appendChild(lockBadge());
    card.appendChild(head);

    if (node.role) {
      card.appendChild(el('div', { class: 'nc-role' }, node.role));
    }

    card.appendChild(rwx(node));

    if (!opts.compact) {
      card.appendChild(el('div', { class: 'nc-summary' }, node.summary || ''));
    }

    const foot = el('div', { class: 'nc-foot' });
    foot.appendChild(el('span', { class: 'nc-ts' }, node.lastSuccess ? `· ${node.lastSuccess}` : '· —'));
    if (node.cacheAge) foot.appendChild(el('span', { class: 'nc-cache' }, `cache ${node.cacheAge}`));
    card.appendChild(foot);

    if (node.blocked_reason) {
      card.appendChild(el('div', { class: 'nc-blocker' }, '⚠ ' + node.blocked_reason));
    }

    return card;
  }

  /* ---- Page header & shell helpers ---- */
  function topbar(crumbHere, opts = {}) {
    const bridgeExpired = opts.bridgeExpired === true;
    return el('header', { class: 'gw-topbar' },
      el('div', { class: 'brand' },
        el('div', { class: 'logo' }),
        el('div', { class: 'name', html: 'To Knowledge<br/><span class="sub">Mission Control · Gateway</span>' }),
      ),
      el('div', { class: 'crumbs' },
        el('a', { href: '/tkmc' }, 'Mission Control'),
        el('span', { class: 'sep' }, '›'),
        el('a', { href: '/gateway' }, 'Gateway'),
        el('span', { class: 'sep' }, '›'),
        el('span', { class: 'here' }, crumbHere),
      ),
      el('div', { class: 'grow' }),
      el('div', {
        class: 'bridge-pill' + (bridgeExpired ? ' expired' : ''),
        title: bridgeExpired ? 'Bridge Session expired' : 'Bridge Session active',
      },
        el('span', { class: 'dot' }),
        bridgeExpired ? 'Bridge Session · expired' : 'Bridge Session · 24m left'
      ),
      el('div', { class: 'owner' },
        el('div', { class: 'avatar' }, 'L'),
        el('div', { html: '<div style="color:var(--t-1);font-weight:500">Luis (Owner)</div><div style="color:var(--t-3);font-size:11px">commander seat</div>' }),
      ),
    );
  }

  const NAV_ITEMS = [
    ['index.html',                'Index'],
    ['Gateway Overview.html',     'Overview'],
    ['Gateway Routes.html',       'Routes'],
    ['Gateway Registry.html',     'Registry'],
    ['Gateway Policies.html',     'Policies'],
    ['Gateway Health.html',       'Health'],
    ['Agent Zero Commander.html', 'Agent Zero'],
    ['Hermes Lieutenant.html',    'Hermes'],
    ['OpenCloud Workers.html',    'Workers'],
    ['OpenClaw+ Skills.html',     'OpenClaw+'],
    ['Brain Systems.html',        'Brain'],
    ['Delivery Connectors.html',  'Connectors'],
    ['node-card-spec.html',       'Node spec'],
    ['color-status-legend.html',  'Legend'],
    ['mobile-tablet.html',        'Mobile'],
  ];

  function pagenav(current) {
    const nav = el('nav', { class: 'gw-pagenav' });
    NAV_ITEMS.forEach(([href, label]) => {
      const a = el('a', { href, class: href === current ? 'active' : '' }, label);
      nav.appendChild(a);
    });
    return nav;
  }

  return { el, statusPill, rwx, lockBadge, nodeCard, topbar, pagenav, NAV_ITEMS };
})();
