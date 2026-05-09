(function () {
  if (window.top === window) return;

  const API = '/api/bridge/approval-requests';

  function text(value, fallback) {
    const v = String(value == null ? '' : value).trim();
    return v || fallback || '';
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value == null || value === false) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = String(value);
      else if (key === 'onClick') node.addEventListener('click', value);
      else node.setAttribute(key, String(value));
    });
    (children || []).forEach((child) => {
      if (child == null) return;
      node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function stateLabel(row) {
    return text(row.ui_state, 'unknown').toUpperCase();
  }

  function eventClass(row) {
    const state = text(row.ui_state, '').toLowerCase();
    if (state === 'completed' || state === 'approved' || state === 'running') return 'used';
    if (state === 'denied' || state === 'expired' || state === 'failed') return 'denied';
    return 'granted';
  }

  function shortDate(value) {
    if (!value) return '--';
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return String(value).slice(0, 19);
    return parsed.toISOString().slice(11, 23);
  }

  async function request(path, options) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      ...options,
    });
    const body = await response.json().catch(() => ({}));
    return { response, body };
  }

  async function decide(row, decision) {
    const command = row.commands && row.commands[decision];
    if (!command || !command.enabled || !command.path) return;
    const buttons = document.querySelectorAll('.tg-btn');
    buttons.forEach((button) => button.classList.add('disabled'));
    await request(command.path, {
      method: command.method || 'POST',
      body: JSON.stringify({ reason: `${decision}_from_mission_control_bridge_ui` }),
    });
    await hydrate();
  }

  function renderPrompt(payload) {
    const meta = document.getElementById('bridge-owner-prompt-meta');
    const body = document.getElementById('bridge-owner-prompt-body');
    if (!body) return;

    const pending = payload.approval_ui_state && payload.approval_ui_state.pending || [];
    const latest = pending[0];
    if (meta) meta.textContent = pending.length ? `${pending.length} pending` : 'live queue';

    const telegram = el('div', { class: 'telegram' }, [
      el('div', { class: 'tg-bot' }, [
        el('div', { class: 'av', text: 'TK' }),
        el('div', { class: 'nm' }, [
          'To-Knowledge bot',
          el('div', { class: 'sub', text: latest ? 'Mission Control approval queue' : 'No pending owner action' }),
        ]),
      ]),
    ]);

    if (latest) {
      telegram.appendChild(el('div', { class: 'tg-msg' }, [
        el('strong', { text: 'Bridge approval requested' }),
        el('br'),
        `${text(latest.title, 'Protected action')} requires owner approval before execution.`,
        el('br'),
        el('br'),
        el('strong', { text: 'Scope:' }),
        ` ${text(latest.scope_label, 'unknown scope')}`,
        el('br'),
        el('strong', { text: 'Risk:' }),
        ` ${text(latest.risk_level, 'unknown')}`,
        el('br'),
        el('strong', { text: 'Caller:' }),
        ` ${text(latest.id, 'unknown')}`,
      ]));
      telegram.appendChild(el('div', { class: 'tg-buttons' }, [
        el('button', { class: 'tg-btn', type: 'button', onClick: () => decide(latest, 'approve') }, ['Approve']),
        el('button', { class: 'tg-btn deny', type: 'button', onClick: () => decide(latest, 'deny') }, ['Deny']),
      ]));
    } else {
      telegram.appendChild(el('div', { class: 'tg-msg' }, [
        el('strong', { text: 'No approvals pending' }),
        el('br'),
        text(payload.ui_placeholder && payload.ui_placeholder.message, 'Completed, denied, expired, and failed requests remain in approval history.'),
      ]));
      telegram.appendChild(el('div', { class: 'tg-buttons' }, [
        el('div', { class: 'tg-btn disabled', 'aria-disabled': 'true', text: 'Approve' }),
        el('div', { class: 'tg-btn deny disabled', 'aria-disabled': 'true', text: 'Deny' }),
      ]));
    }

    body.replaceChildren(telegram);
  }

  function renderAudit(payload) {
    const meta = document.getElementById('bridge-audit-meta');
    const grid = document.getElementById('bridge-audit-grid');
    if (!grid) return;

    const state = payload.approval_ui_state || {};
    const rows = [...(state.pending || []), ...(state.history || [])].slice(0, 8);
    if (meta) meta.textContent = `${rows.length} events`;
    if (!rows.length) return;

    grid.replaceChildren(
      el('div', { class: 'hd', text: 'timestamp' }),
      el('div', { class: 'hd', text: 'event' }),
      el('div', { class: 'hd', text: 'what' }),
      el('div', { class: 'hd', text: 'via' }),
      el('div', { class: 'hd', style: 'text-align:right;', text: 'latency' }),
    );

    rows.forEach((row) => {
      const requestId = el('div', { class: 'sub' }, [
        'request ',
        el('code', { text: row.id }),
      ]);
      const wrapper = document.createElement('div');
      wrapper.className = 'arow';
      wrapper.style.display = 'contents';
      wrapper.append(
        el('div', { class: 'ts', text: shortDate(row.requested_at) }),
        el('div', { class: `ev ${eventClass(row)}`, text: stateLabel(row) }),
        el('div', { class: 'what' }, [
          text(row.title, 'approval request'),
          requestId,
        ]),
        el('div', { class: 'who', text: text(row.audit && row.audit.latest_actor, row.requester || 'mission-control') }),
        el('div', { class: 'lat', text: row.result_label || '--' }),
      );
      grid.appendChild(wrapper);
    });
  }

  function renderSessions(payload) {
    const meta = document.getElementById('bridge-session-list-meta');
    const list = document.getElementById('bridge-session-list');
    if (!list) return;
    const state = payload.approval_ui_state || {};
    const rows = [...(state.pending || []), ...(state.history || [])].slice(0, 6);
    if (meta) meta.textContent = `${state.summary && state.summary.total || rows.length} total`;
    if (!rows.length) return;
    list.replaceChildren(...rows.map((row) => el('div', { class: 'sess' }, [
      el('div', {}, [
        el('div', { class: 'id', text: row.id }),
        el('div', { class: 'meta' }, [
          text(row.scope && row.scope.action, row.title),
          ' · ',
          text(row.scope && row.scope.target_key, 'no target'),
        ]),
      ]),
      el('span', { class: `stat ${row.ui_state === 'pending' ? 'active' : row.ui_state === 'denied' ? 'revoked' : 'expired'}`, text: stateLabel(row) }),
    ])));
  }

  function renderBlocked(message) {
    renderPrompt({
      ui_placeholder: {
        message,
      },
      approval_ui_state: {
        pending: [],
        history: [],
        summary: { total: 0 },
      },
    });
  }

  async function hydrate() {
    try {
      const { response, body } = await request(API);
      if (!response.ok || !body || !body.ok) {
        renderBlocked(`Approval queue unavailable: HTTP ${response.status}`);
        return;
      }
      renderPrompt(body);
      renderAudit(body);
      renderSessions(body);
    } catch (_error) {
      renderBlocked('Approval queue unavailable in this browser session.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate, { once: true });
  } else {
    hydrate();
  }
})();
