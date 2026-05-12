// Owner-facing error copy helper.
//
// This browser-side helper keeps visible Mission Control errors inside the
// approved blocker vocabulary. It redacts raw paths, private hosts, auth files,
// and secret-looking values before anything reaches notifications or inline UI.
(function () {
  const TEMPLATES = {
    OWNER_GATED: {
      owner_message: 'Owner approval is required.',
      next_action: 'Approve the exact scoped action through Mission Control or Bridge Session.',
      owner_action_required: true,
      codex_can_fix: false,
    },
    CREDENTIAL_GATED: {
      owner_message: 'A required credential is missing.',
      next_action: 'Add the credential through the approved secret path, then retry.',
      owner_action_required: true,
      codex_can_fix: false,
    },
    SERVICE_DOWN: {
      owner_message: 'The backing service is unreachable.',
      next_action: 'Restore the service or keep this lane marked SERVICE_DOWN.',
      owner_action_required: true,
      codex_can_fix: false,
    },
    BACKEND_MISSING: {
      owner_message: 'Backend wiring for this feature is not in place yet.',
      next_action: 'Codex must wire the missing backend adapter before this can be used.',
      owner_action_required: false,
      codex_can_fix: true,
    },
    ROUTE_MISSING: {
      owner_message: 'This route is not wired yet.',
      next_action: 'Codex must add the missing Mission Control or Gateway route.',
      owner_action_required: false,
      codex_can_fix: true,
    },
    AUTH_REQUIRED: {
      owner_message: 'Sign-in is required.',
      next_action: 'Sign in through Mission Control before retrying.',
      owner_action_required: true,
      codex_can_fix: false,
    },
    EXECUTION_DISABLED: {
      owner_message: 'Execution is disabled in the current safety mode.',
      next_action: 'Use Bridge Session approval before enabling protected execution.',
      owner_action_required: true,
      codex_can_fix: false,
    },
    WRITE_DISABLED: {
      owner_message: 'Writes are disabled in the current safety mode.',
      next_action: 'Use Bridge Session approval before enabling writes.',
      owner_action_required: true,
      codex_can_fix: false,
    },
    EXTERNAL_WRITE_DISABLED: {
      owner_message: 'External writes are disabled in the current safety mode.',
      next_action: 'Use Bridge Session approval before enabling connector writes.',
      owner_action_required: true,
      codex_can_fix: false,
    },
    UNKNOWN: {
      owner_message: 'The blocker is not classified yet.',
      next_action: 'Codex must inspect safe logs and add a classifier rule for this signal.',
      owner_action_required: false,
      codex_can_fix: true,
    },
  };

  const RX_OWNER = /(owner.?gated|owner.?approval|awaiting owner|awaiting approval|approval required|bridge session|scope required|locked)/i;
  const RX_CRED = /(credential|api[_ -]?key|missing.*token|missing.*secret|oauth|unauthorized.*key|bot token|service account)/i;
  const RX_SERVICE = /(service.*(?:down|unavailable|not running)|systemd.*inactive|systemctl.*failed|connection.?refused|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|network error|failed to fetch)/i;
  const RX_BACKEND = /(backend.*missing|backend.*required|adapter.*missing|not implemented|not_implemented|unsupported|stub|TODO)/i;
  const RX_ROUTE = /(route.*missing|HTTP 404|404|page not found)/i;
  const RX_AUTH = /(HTTP 401|401|authentication.*required|unauthori[sz]ed|please log in|sign in|session expired)/i;
  const RX_DISABLED = /(execution.*disabled|writes?.*disabled|external.*writes?.*disabled|read[_ -]?only mode|run.*disabled)/i;

  const USER_PATH_RE = /\/Users\/[A-Za-z0-9._-]+(?:\/[^\s"'`),;]*)?/g;
  const HOME_PATH_RE = /\/home\/[A-Za-z0-9._-]+(?:\/[^\s"'`),;]*)?/g;
  const ABS_PATH_RE = /(?:\/[A-Za-z0-9._-]+){2,}(?:\/[^\s"'`),;]*)?/g;
  const PRIVATE_HOST_RE = /\b(?:127\.0\.0\.1|localhost|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)(?::\d+)?\b/g;
  const SECRET_KEY_RE = /\b(?:sk-[A-Za-z0-9_-]{16,}|xox[abp]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|firecrawl-[A-Za-z0-9_-]{16,}|[A-Fa-f0-9]{40,})\b/g;
  const BEARER_RE = /Bearer\s+[A-Za-z0-9._-]{8,}/gi;
  const ENV_KV_RE = /(API_KEY|TOKEN|SECRET|PASSWORD|PASSCODE|ACCESS_KEY|SESSION_KEY|COOKIE)=([^\s"']+)/gi;
  const AUTH_FILE_RE = /\b(?:auth\.json|\.env(?:\.[A-Za-z0-9_-]+)?|credentials\.json)\b/gi;

  function sanitize(value) {
    return String(value || '')
      .replace(BEARER_RE, 'Bearer [redacted]')
      .replace(SECRET_KEY_RE, '[redacted-secret]')
      .replace(ENV_KV_RE, function (_match, key) { return key + '=[redacted]'; })
      .replace(AUTH_FILE_RE, '[redacted-auth-file]')
      .replace(USER_PATH_RE, '[redacted-user-path]')
      .replace(HOME_PATH_RE, '[redacted-home-path]')
      .replace(PRIVATE_HOST_RE, '[redacted-host]')
      .replace(ABS_PATH_RE, function (match) {
        return /^\/(?:api|gateway|agent|agents|tkmc|login|setup|design)(?:\/|$)/.test(match)
          ? match
          : '[redacted-path]';
      })
      .trim();
  }

  function signal(input) {
    const value = input || {};
    const body = value.body && typeof value.body === 'object' ? value.body : {};
    const httpStatus = value.http_status || value.status || body.status || null;
    const code = value.code || body.error || body.code || '';
    const message = value.message || value.detail || body.message || body.error_description || body.error || String(input || '');
    const detail = value.technical_detail || value.detail || value.stack || message;
    const context = value.context || {};
    return {
      http_status: Number(httpStatus) || null,
      code: String(code || ''),
      message: sanitize(message),
      technical_detail: sanitize(detail),
      context,
    };
  }

  function classify(input) {
    const s = signal(input);
    const combined = [s.code, s.message, s.technical_detail].filter(Boolean).join(' ');
    let kind = 'UNKNOWN';

    if (s.context.requires_owner_approval || RX_OWNER.test(combined) || s.http_status === 423 || s.http_status === 403) kind = 'OWNER_GATED';
    else if (s.http_status === 401 || RX_AUTH.test(combined)) kind = 'AUTH_REQUIRED';
    else if ([502, 503, 504].includes(s.http_status) || RX_SERVICE.test(combined)) kind = 'SERVICE_DOWN';
    else if (s.context.has_credential === false || RX_CRED.test(combined)) kind = 'CREDENTIAL_GATED';
    else if (s.context.has_backend === false || RX_BACKEND.test(combined)) kind = 'BACKEND_MISSING';
    else if (s.http_status === 404 || RX_ROUTE.test(combined)) kind = 'ROUTE_MISSING';
    else if (s.context.external_writes_enabled === false || /external.*write/i.test(combined)) kind = 'EXTERNAL_WRITE_DISABLED';
    else if (s.context.writes_enabled === false || /writes?.*disabled|read[_ -]?only/i.test(combined)) kind = 'WRITE_DISABLED';
    else if (s.context.execution_enabled === false || RX_DISABLED.test(combined)) kind = 'EXECUTION_DISABLED';

    const template = TEMPLATES[kind] || TEMPLATES.UNKNOWN;
    return {
      kind,
      blocker_class: kind,
      owner_message: template.owner_message,
      next_action: template.next_action,
      technical_detail: s.technical_detail.slice(0, 220),
      owner_action_required: template.owner_action_required,
      codex_can_fix: template.codex_can_fix,
    };
  }

  function text(input) {
    const c = classify(input);
    return c.kind + ': ' + c.owner_message + ' Next: ' + c.next_action;
  }

  function notificationEntry(entry) {
    const next = Object.assign({}, entry || {});
    const isErrorish = /^(err|error|warn)$/i.test(String(next.kind || ''));
    next.title = sanitize(next.title || '');
    if (isErrorish) {
      next.detail = text(next.error || next);
    } else {
      next.detail = sanitize(next.detail || '');
    }
    return next;
  }

  window.OwnerErrorCopy = { classify, text, sanitize, notificationEntry };
  window.ownerFacingError = classify;
  window.ownerFacingErrorText = text;
})();
