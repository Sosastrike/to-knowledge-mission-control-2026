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

  function cssStatusForColor(colorOrStatus) {
    return colorOrStatus === 'cyan' ? 'blue' : (colorOrStatus || 'gray');
  }

  function statusPill(status, label) {
    const cssStatus = cssStatusForColor(status);
    const text = label || G.STATUS[cssStatus]?.label || status;
    return el('span', { class: `pill ${cssStatus}` }, el('span', { class: 'dot' }), text);
  }

  function nodeReadiness(node) {
    if (!node) return null;
    if (node.node_readiness) return node.node_readiness;
    if (G.getNodeReadiness) return G.getNodeReadiness(node.id);
    return null;
  }

  function readinessCssStatus(readiness, fallbackStatus) {
    if (!readiness) return cssStatusForColor(fallbackStatus || 'gray');
    return cssStatusForColor(readiness.color || readiness.status);
  }

  function readinessColor(readiness, fallbackStatus) {
    if (!readiness) return G.statusColor(fallbackStatus || 'gray');
    return ({
      green: 'var(--st-green)',
      cyan: 'var(--brand-cyan)',
      yellow: 'var(--st-yellow)',
      gray: 'var(--st-gray)',
      red: 'var(--st-red)',
    })[readiness.color] || G.statusColor(cssStatusForColor(readiness.color || fallbackStatus || 'gray'));
  }

  function guardedWrite(readiness) {
    if (!readiness) return false;
    return readiness.approval_required === true && readiness.write_ready !== true;
  }

  function guardedExecute(readiness) {
    if (!readiness) return false;
    return readiness.approval_required === true && readiness.execute_ready !== true;
  }

  function rwx(node, readiness = nodeReadiness(node)) {
    const readOn = readiness ? readiness.read_ready === true : Boolean(node.R);
    const writeOn = readiness ? readiness.write_ready === true : Boolean(node.W);
    const executeOn = readiness ? readiness.execute_ready === true : Boolean(node.X);
    return el('div', { class: 'rwx', title: 'Read · Write · Execute' },
      el('span', { class: `rwx-pill r ${readOn ? 'on' : ''}` }, 'R'),
      el('span', { class: `rwx-pill w ${writeOn ? 'on' : guardedWrite(readiness) ? 'guarded' : ''}` }, 'W'),
      el('span', { class: `rwx-pill x ${executeOn ? 'on' : guardedExecute(readiness) ? 'guarded' : ''}` }, 'X'),
    );
  }

  function lockBadge(scope) {
    const detail = scope
      ? `Locked scope: ${scope}. Writes, execution, external delivery, credentials, billing, or policy may be guarded by Gateway policy and owner approval.`
      : 'Writes/execution guarded by Gateway policy and owner approval';
    return el('span', { class: 'bridge-lock', title: detail, html:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
    });
  }

  /* ---- Node card ---- */
  function nodeCard(node, opts = {}) {
    const readiness = nodeReadiness(node);
    const cssStatus = readinessCssStatus(readiness, node.status);
    const dotColor = readinessColor(readiness, node.status);
    const summary = readiness?.short_label || node.summary || '';
    const card = el('div', {
      class: `node-card status-${cssStatus} type-${node.type}`,
      'data-id': node.id,
      'data-status': cssStatus,
      'data-node-readiness-status': readiness?.status || '',
      'data-node-readiness-color': readiness?.color || '',
      'data-node-readiness-reason': readiness?.primary_reason || '',
    });
    const head = el('div', { class: 'nc-head' });
    head.appendChild(el('div', { class: 'nc-dot', style: { background: dotColor } }));
    head.appendChild(el('div', { class: 'nc-name' }, node.name));
    if (node.bridge || readiness?.approval_required) head.appendChild(lockBadge(readiness?.lock_scope));
    card.appendChild(head);

    if (node.role) {
      card.appendChild(el('div', { class: 'nc-role' }, node.role));
    }

    if (readiness) {
      card.appendChild(el('div', { class: 'nc-statusline' },
        statusPill(readiness.color, readiness.status),
        el('span', { class: 'nc-reason', title: readiness.primary_reason }, readiness.primary_reason || ''),
      ));
    }

    card.appendChild(rwx(node, readiness));

    if (!opts.compact) {
      card.appendChild(el('div', { class: 'nc-summary' }, summary));
    }

    const foot = el('div', { class: 'nc-foot' });
    foot.appendChild(el('span', { class: 'nc-ts' }, node.lastSuccess ? `· ${node.lastSuccess}` : '· —'));
    if (node.cacheAge) foot.appendChild(el('span', { class: 'nc-cache' }, `cache ${node.cacheAge}`));
    card.appendChild(foot);

    const blocker = readiness?.status === 'blocked'
      ? readiness.primary_reason
      : node.blocked_reason;
    if (blocker) {
      card.appendChild(el('div', { class: 'nc-blocker' }, '⚠ ' + blocker));
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
        el('span', {}, 'Mission Control'),
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
    ['OpenCloud Workers.html',    'OpenCloud'],
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

  return { el, statusPill, rwx, lockBadge, nodeCard, topbar, pagenav, NAV_ITEMS, nodeReadiness, readinessCssStatus, readinessColor };
})();
