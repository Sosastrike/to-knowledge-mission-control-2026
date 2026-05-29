import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { RON_WEASLEY_IDENTITY } from './hermes-boundaries'
import { HERMES_COMMAND_CENTER_ROUTE, HERMES_LEGACY_WEB_INTERFACE_BASE, HERMES_STANDALONE_PROXY_ROUTE, HERMES_WEB_INTERFACE_BASE } from './hermes-web-interface'

type HermesWebUiState = 'READY' | 'SERVICE_UNREACHABLE' | 'BACKEND_REQUIRED'

const DEFAULT_WEBUI_URL = 'http://127.0.0.1:8787/'
const REPO_URL = 'https://github.com/Sosastrike/To-Knowledge-hermes-webui.git'
const CANONICAL_SERVER_REPO_PATH = '/home/tony/To-Knowledge-hermes-webui'
const CANONICAL_SERVER_RUNTIME_PATH = '/home/tony/hermes-webui-runtime'
const HERMES_WEBUI_MISSION_CONTROL_PAGES = [
  HERMES_WEB_INTERFACE_BASE,
  `${HERMES_WEB_INTERFACE_BASE}/config`,
  `${HERMES_WEB_INTERFACE_BASE}/status`,
  `${HERMES_WEB_INTERFACE_BASE}/routes`,
  `${HERMES_WEB_INTERFACE_BASE}/brain-map`,
  `${HERMES_WEB_INTERFACE_BASE}/tool-map`,
  `${HERMES_WEB_INTERFACE_BASE}/skill-registry`,
  `${HERMES_WEB_INTERFACE_BASE}/mini-agent-registry`,
  `${HERMES_WEB_INTERFACE_BASE}/pipelines`,
  `${HERMES_WEB_INTERFACE_BASE}/tasks`,
  `${HERMES_WEB_INTERFACE_BASE}/logs`,
] as const
const HERMES_WEBUI_LEGACY_MISSION_CONTROL_PAGES = HERMES_WEBUI_MISSION_CONTROL_PAGES.map((route) =>
  route.replace(HERMES_WEB_INTERFACE_BASE, HERMES_LEGACY_WEB_INTERFACE_BASE),
)
const HERMES_WEBUI_REQUIRED_UI_SECTIONS = [
  'Ron Weasley Overview',
  'Status / readiness',
  'Active dispatch plans',
  'Jarvis concurrence queue',
  'Brain / memory map',
  'Tool map',
  'Skill registry',
  'Mini-agent registry',
  'Workflow compiler',
  'Paperclip intelligence',
  'n8n / Zapier optimization',
  'Agent performance optimizer',
  'Logs / audit / rollback',
] as const
const REQUIRED_ENV_NAMES = [
  'HERMES_WEBUI_REPO',
  'HERMES_WEBUI_SOURCE_REPO',
  'HERMES_WEBUI_RUNTIME_DIR',
  'HERMES_WEBUI_AGENT_DIR',
  'HERMES_WEBUI_PYTHON',
  'HERMES_WEBUI_HOST',
  'HERMES_WEBUI_PORT',
  'HERMES_WEBUI_URL',
  'HERMES_WEBUI_STATE_DIR',
  'HERMES_WEBUI_DEFAULT_WORKSPACE',
  'HERMES_WEBUI_DEFAULT_MODEL',
  'HERMES_WEBUI_BOT_NAME',
  'HERMES_WEBUI_PASSWORD',
  'HERMES_WEBUI_AUTO_INSTALL',
  'HERMES_WEBUI_SKIP_ONBOARDING',
  'HERMES_WEBUI_ATTACHMENT_DIR',
  'HERMES_WEBUI_MAX_UPLOAD_MB',
  'HERMES_WEBUI_FOLDER_ZIP_MAX_MB',
  'HERMES_WEBUI_FOLDER_ZIP_MAX_FILES',
  'HERMES_WEBUI_TLS_CERT',
  'HERMES_WEBUI_TLS_KEY',
  'HERMES_WEBUI_EXTENSION_DIR',
  'HERMES_WEBUI_EXTENSION_SCRIPT_URLS',
  'HERMES_WEBUI_EXTENSION_STYLESHEET_URLS',
  'HERMES_WEBUI_RUNTIME_ADAPTER',
  'HERMES_WEBUI_RUN_JOURNAL_FSYNC',
  'HERMES_WEBUI_SESSION_TTL',
  'HERMES_WEBUI_ALLOWED_ORIGINS',
  'HERMES_WEBUI_WORKSPACE_GIT_DESTRUCTIVE',
  'HERMES_WEBUI_FOREGROUND',
  'HERMES_WEBUI_HEALTH_URL',
  'HERMES_WEBUI_LOG_DIR',
  'HERMES_WEBUI_REQUIRE_AGENT_PROCESS',
  'HERMES_WEBUI_PID_FILE',
  'HERMES_WEBUI_LOG_FILE',
  'HERMES_WEBUI_CTL_STATE_FILE',
  'HERMES_UID',
  'HERMES_GID',
  'HERMES_SKIP_CHMOD',
  'HERMES_HOME_MODE',
  'HERMES_HOME',
  'HERMES_CONFIG_PATH',
  'HERMES_EXEC_ASK',
  'HERMES_SESSION_KEY',
  'UID',
  'GID',
  'WANTED_UID',
  'WANTED_GID',
  'HERMES_WORKSPACE',
]

function configuredUrl() {
  return (process.env.HERMES_WEBUI_URL || DEFAULT_WEBUI_URL).trim()
}

function isSafeLocalWebUiUrl(raw: string) {
  try {
    const url = new URL(raw)
    return ['http:', 'https:'].includes(url.protocol)
      && !url.username
      && !url.password
      && ['127.0.0.1', 'localhost', '::1'].includes(url.hostname)
  } catch {
    return false
  }
}

function localRepoCandidate() {
  const explicit = process.env.HERMES_WEBUI_REPO
  if (explicit) return resolve(explicit)
  return resolve(process.cwd(), '..', 'To-Knowledge-hermes-webui')
}

function localRepoStatus() {
  const repoPath = localRepoCandidate()
  const present = existsSync(join(repoPath, 'server.py'))
    && existsSync(join(repoPath, 'static', 'index.html'))
    && existsSync(join(repoPath, 'api', 'routes.py'))

  return {
    present,
    path: present ? repoPath : null,
    expected_files: ['server.py', 'static/index.html', 'api/routes.py'],
  }
}

function repoSupports(relativePath: string) {
  return relativePath
}

function hasFile(repoPath: string | null, relativePath: string) {
  return repoPath ? existsSync(join(repoPath, relativePath)) : false
}

function readSmall(repoPath: string | null, relativePath: string) {
  if (!repoPath) return ''
  try {
    return readFileSync(join(repoPath, relativePath), 'utf8').slice(0, 150_000)
  } catch {
    return ''
  }
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

function extractEnvNamesFromText(text: string) {
  const names = text.match(/\b(?:HERMES|WANTED|GATEWAY|TERMINAL|XDG|UV|BUILD_APT_PROXY|UID|GID)[A-Z0-9_]*\b/g) || []
  return uniqueSorted(names.filter((name) => !name.endsWith('_')))
}

function readEnvFileNames(repoPath: string | null, relativePath: string) {
  if (!repoPath) return []
  const text = readSmall(repoPath, relativePath)
  return uniqueSorted(text
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1])
    .filter((name): name is string => Boolean(name)))
}

async function probeHealth(raw: string) {
  if (!isSafeLocalWebUiUrl(raw)) {
    return {
      reachable: false,
      state: 'BACKEND_REQUIRED' as HermesWebUiState,
      exact_blocker: 'hermes_webui_url_must_be_loopback',
      status_code: null,
    }
  }

  const url = new URL('/health', raw)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1200)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    })
    return {
      reachable: response.ok,
      state: response.ok ? 'READY' as HermesWebUiState : 'SERVICE_UNREACHABLE' as HermesWebUiState,
      exact_blocker: response.ok ? null : 'hermes_webui_health_not_ready',
      status_code: response.status,
    }
  } catch {
    return {
      reachable: false,
      state: 'SERVICE_UNREACHABLE' as HermesWebUiState,
      exact_blocker: 'hermes_webui_service_not_running',
      status_code: null,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export function getHermesWebUiUrl() {
  return configuredUrl()
}

export function getHermesWebUiBrowserUrl() {
  return HERMES_STANDALONE_PROXY_ROUTE
}

export async function buildHermesWebUiPreflight() {
  const repo = localRepoStatus()
  const local_url = configuredUrl()
  const readme = readSmall(repo.path, 'README.md')
  const dockerCompose = hasFile(repo.path, 'docker-compose.yml')
  const dockerComposeTwoContainer = hasFile(repo.path, 'docker-compose.two-container.yml')
  const dockerComposeThreeContainer = hasFile(repo.path, 'docker-compose.three-container.yml')
  const dockerfile = hasFile(repo.path, 'Dockerfile')
  const requirements = hasFile(repo.path, 'requirements.txt')
  const server = hasFile(repo.path, 'server.py')
  const bootstrap = hasFile(repo.path, 'bootstrap.py')
  const ctl = hasFile(repo.path, 'ctl.sh')
  const start = hasFile(repo.path, 'start.sh')
  const apiConfig = readSmall(repo.path, 'api/config.py')
  const apiRoutes = readSmall(repo.path, 'api/routes.py')
  const serverPy = readSmall(repo.path, 'server.py')
  const dockerComposeText = readSmall(repo.path, 'docker-compose.yml')
  const dockerComposeTwoContainerText = readSmall(repo.path, 'docker-compose.two-container.yml')
  const dockerComposeThreeContainerText = readSmall(repo.path, 'docker-compose.three-container.yml')
  const dockerfileText = readSmall(repo.path, 'Dockerfile')
  const ctlText = readSmall(repo.path, 'ctl.sh')
  const bootstrapText = readSmall(repo.path, 'bootstrap.py')
  const startupText = readSmall(repo.path, 'api/startup.py')
  const authText = readSmall(repo.path, 'api/auth.py')
  const streamingText = readSmall(repo.path, 'api/streaming.py')
  const workspaceGitText = readSmall(repo.path, 'docs/workspace-git.md')
  const wslAutostartText = readSmall(repo.path, 'docs/wsl-autostart.md')
  const envExampleNames = readEnvFileNames(repo.path, '.env.example')
  const dockerEnvExampleNames = readEnvFileNames(repo.path, '.env.docker.example')
  const stateDir = process.env.HERMES_WEBUI_STATE_DIR || '~/.hermes/webui'
  const agentDir = process.env.HERMES_WEBUI_AGENT_DIR || `${process.env.HERMES_HOME || '~/.hermes'}/hermes-agent`
  const agentDirPresent = existsSync(agentDir.replace(/^~(?=$|\/)/, process.env.HOME || ''))
  const canonicalServerPathPresent = existsSync(CANONICAL_SERVER_REPO_PATH)
  const localUrlSafe = isSafeLocalWebUiUrl(local_url)
  const composeLoopbackPort = /127\.0\.0\.1:8787:8787/.test(dockerComposeText)
  const repoDeclaredEnvNames = uniqueSorted([
    ...envExampleNames,
    ...dockerEnvExampleNames,
    ...extractEnvNamesFromText([
      readme,
      apiConfig,
      apiRoutes,
      serverPy,
      dockerComposeText,
      dockerComposeTwoContainerText,
      dockerComposeThreeContainerText,
      dockerfileText,
      ctlText,
      bootstrapText,
      startupText,
      authText,
      streamingText,
      workspaceGitText,
      wslAutostartText,
    ].join('\n')),
  ])
  const envNamesFound = REQUIRED_ENV_NAMES.filter((name) => {
    const pattern = new RegExp(`\\b${name}\\b`)
    return repoDeclaredEnvNames.includes(name)
      || pattern.test(readme)
      || pattern.test(apiConfig)
      || pattern.test(apiRoutes)
      || pattern.test(serverPy)
      || pattern.test(dockerComposeText)
      || pattern.test(dockerComposeTwoContainerText)
      || pattern.test(dockerComposeThreeContainerText)
      || pattern.test(dockerfileText)
      || pattern.test(ctlText)
      || pattern.test(bootstrapText)
      || pattern.test(startupText)
      || pattern.test(authText)
      || pattern.test(streamingText)
      || pattern.test(workspaceGitText)
      || pattern.test(wslAutostartText)
  })
  const blockers = [
    !repo.present ? 'hermes_webui_repo_not_found' : null,
    !server ? 'hermes_webui_server_entrypoint_missing' : null,
    !bootstrap ? 'hermes_webui_bootstrap_entrypoint_missing' : null,
    !requirements ? 'hermes_webui_requirements_missing' : null,
    !localUrlSafe ? 'hermes_webui_url_must_be_loopback' : null,
    !agentDirPresent ? 'hermes_agent_checkout_or_config_required_for_full_agent_features' : null,
    !canonicalServerPathPresent ? 'canonical_server_path_not_available_in_this_local_workspace' : null,
  ].filter(Boolean) as string[]

  return {
    route: 'bridge.hermes-webui.preflight',
    project: 'Ron Weasley WebUI Mission Control Integration',
    canonical_name: RON_WEASLEY_IDENTITY.canonical_name,
    short_name: RON_WEASLEY_IDENTITY.short_name,
    full_title: RON_WEASLEY_IDENTITY.full_title,
    legacy_names: RON_WEASLEY_IDENTITY.legacy_names,
    repo_url: REPO_URL,
    requested_server_repo_path: CANONICAL_SERVER_REPO_PATH,
    requested_server_runtime_path: CANONICAL_SERVER_RUNTIME_PATH,
    inspected_repo_path: repo.path,
    repo_present: repo.present,
    runtime_type: 'python_threading_http_server_vanilla_js_sse',
    app_entrypoints: {
      server_py: server,
      bootstrap_py: bootstrap,
      start_sh: start,
      ctl_sh: ctl,
    },
    install_methods: {
      standalone_python_service: server && requirements,
      ctl_daemon_wrapper: ctl,
      docker_compose: dockerCompose,
      docker_compose_two_container: dockerComposeTwoContainer,
      docker_compose_three_container: dockerComposeThreeContainer,
      dockerfile,
      dev_server_only: false,
      production_server: true,
    },
    required_ports: {
      default_port: 8787,
      chosen_safe_port: 8787,
      bind_policy: '127.0.0.1_or_tailnet_only',
      docker_compose_default_exposes_loopback_only: composeLoopbackPort,
      known_conflicts_avoided: [3337, 3100, 50080, 5678, 18789, 8771],
    },
    required_env_names: REQUIRED_ENV_NAMES,
    repo_env_names_confirmed_by_name_only: envNamesFound,
    repo_declared_env_names_by_name_only: repoDeclaredEnvNames,
    env_file_names_by_name_only: {
      env_example: envExampleNames,
      env_docker_example: dockerEnvExampleNames,
    },
    secret_env_names_by_name_only: [
      'HERMES_WEBUI_PASSWORD',
      'ANTHROPIC_API_KEY',
      'OPENAI_API_KEY',
      'OPENROUTER_API_KEY',
      'GOOGLE_API_KEY',
      'GEMINI_API_KEY',
      'DEEPSEEK_API_KEY',
      'LOCAL_API_KEY',
    ],
    secrets_required_for_webui_shell: false,
    secrets_required_for_full_agent_model_calls: true,
    docker_support: dockerCompose && dockerfile,
    docker_topologies: {
      single_container_recommended: dockerCompose,
      two_container_supported_with_source_boundary_caveat: dockerComposeTwoContainer,
      three_container_supported_with_dashboard: dockerComposeThreeContainer,
      host_ports_loopback_only: {
        webui: composeLoopbackPort,
        agent_gateway: /127\.0\.0\.1:8642:8642/.test(dockerComposeTwoContainerText + dockerComposeThreeContainerText),
        dashboard: /127\.0\.0\.1:9119:9119/.test(dockerComposeThreeContainerText),
      },
      opencloud_intermediary: false,
    },
    auth_model: {
      default: 'password_auth_disabled_on_loopback',
      enable_with: 'HERMES_WEBUI_PASSWORD',
      standalone_login_route: '/login',
      standalone_auth_status_route: '/api/auth/status',
      standalone_auth_login_route: '/api/auth/login',
      mission_control_proxy_preferred: true,
      anonymous_access_allowed_publicly: false,
    },
    hermes_connection_method: {
      expected: 'Ron Weasley Agent checkout/CLI imported by Python path and HERMES_WEBUI_AGENT_DIR/HERMES_HOME',
      agent_dir_name_only: 'HERMES_WEBUI_AGENT_DIR',
      current_agent_dir_present: agentDirPresent,
      creates_second_hermes_brain: false,
      webui_is_browser_surface_only: true,
      direct_line_owner_in_mission_control: 'hermes',
      final_authority: 'agent-zero-jarvis',
    },
    data_directory: stateDir,
    websocket_or_sse_requirements: {
      chat_streaming: 'server_sent_events_owned_by_webui',
      gateway_watcher: 'local_state_watcher',
      websocket_required_for_p0: false,
    },
    install_strategy: {
      p0: 'preflight_and_mission_control_registration_only',
      p1: 'loopback_ctl_daemon_or_systemd_user_service_after_owner_server_hop',
      docker_supported_but_not_primary_first_hop: true,
      public_exposure_requires_owner_approval: true,
      password_required_before_non_loopback_exposure: true,
    },
    public_exposure_risk: localUrlSafe ? 'LOW_LOOPBACK_ONLY' : 'BLOCKED_NON_LOOPBACK_URL',
    no_secret_proof: {
      credential_values_exposed: false,
      env_values_printed: false,
      token_values_printed: false,
    },
    server_install_helper: {
      path: 'scripts/install-hermes-webui-runtime.sh',
      bind_policy: 'loopback_only',
      edits_env_file: false,
      starts_public_listener: false,
      skips_agent_auto_install: true,
    },
    source_inventory: {
      server: repoSupports('server.py'),
      routes: repoSupports('api/routes.py'),
      streaming: repoSupports('api/streaming.py'),
      auth: repoSupports('api/auth.py'),
      config: repoSupports('api/config.py'),
      ui: repoSupports('static/index.html'),
      docker: repoSupports('docker-compose.yml'),
      tests: repoSupports('tests/'),
    },
    preflight_state: blockers.length <= 2 && repo.present && localUrlSafe
      ? 'READY_FOR_P1_WITH_SCOPED_BLOCKERS'
      : 'BLOCKED_FOR_P1_INSTALL',
    exact_blockers: blockers,
    safe_p1_install_command: [
      `git clone ${REPO_URL} ${CANONICAL_SERVER_REPO_PATH}`,
      `mkdir -p ${CANONICAL_SERVER_RUNTIME_PATH}`,
      'cd /path/to/mission-control',
      `HERMES_WEBUI_SOURCE_REPO=${CANONICAL_SERVER_REPO_PATH} HERMES_WEBUI_RUNTIME_DIR=${CANONICAL_SERVER_RUNTIME_PATH} HERMES_WEBUI_HOST=127.0.0.1 HERMES_WEBUI_PORT=8787 ./scripts/install-hermes-webui-runtime.sh`,
      `${CANONICAL_SERVER_RUNTIME_PATH}/bin/run-hermes-webui-local.sh`,
    ],
    safe_p1_status_command: `cd ${CANONICAL_SERVER_REPO_PATH} && HERMES_WEBUI_PID_FILE=${CANONICAL_SERVER_RUNTIME_PATH}/hermes-webui.pid HERMES_WEBUI_LOG_FILE=${CANONICAL_SERVER_RUNTIME_PATH}/logs/hermes-webui.log HERMES_WEBUI_CTL_STATE_FILE=${CANONICAL_SERVER_RUNTIME_PATH}/hermes-webui.ctl.state HERMES_WEBUI_STATE_DIR=${CANONICAL_SERVER_RUNTIME_PATH}/state ./ctl.sh status`,
    safe_p1_rollback_command: `cd ${CANONICAL_SERVER_REPO_PATH} && HERMES_WEBUI_PID_FILE=${CANONICAL_SERVER_RUNTIME_PATH}/hermes-webui.pid HERMES_WEBUI_LOG_FILE=${CANONICAL_SERVER_RUNTIME_PATH}/logs/hermes-webui.log HERMES_WEBUI_CTL_STATE_FILE=${CANONICAL_SERVER_RUNTIME_PATH}/hermes-webui.ctl.state HERMES_WEBUI_STATE_DIR=${CANONICAL_SERVER_RUNTIME_PATH}/state ./ctl.sh stop`,
    current_workspace_note: canonicalServerPathPresent
      ? 'Canonical server path exists in this environment.'
      : 'This local macOS workspace cannot create /home/tony; use the inspected local repo path for local proof and the safe P1 command on srv1568353.',
    readme_mentions_ssh_tunnel: /ssh -N -L/.test(readme),
    rollback_command: 'Stop hermes-webui service/session and remove Mission Control Ron Weasley WebUI route/card registration; no credential, public exposure, or external connector state is created by P0.',
  }
}

export function buildHermesWebUiIdentity() {
  return {
    route: 'bridge.hermes-webui.identity',
    target_agent: 'hermes',
    target_system: 'hermes-webui',
    conversation_owner: 'ron-weasley',
    canonical_name: RON_WEASLEY_IDENTITY.canonical_name,
    short_name: RON_WEASLEY_IDENTITY.short_name,
    full_title: RON_WEASLEY_IDENTITY.full_title,
    legacy_names: RON_WEASLEY_IDENTITY.legacy_names,
    reports_to: 'agent-zero-jarvis',
    direct_line_used: true,
    source_surface: 'hermes-webui',
    opencloud_used: false,
    opencloud_role: 'not_used',
    opencloud_hidden_intermediary: false,
    claudeclaw_in_path: false,
    jarvis_concurrence_required_for_production_actions: true,
    creates_second_hermes_brain: false,
    webui_role: 'browser_control_surface_for_existing_hermes_control_plane',
    visible_task_title: 'Ron Weasley WebUI Mission Control Integration',
    credential_values_exposed: false,
    public_exposure_created: false,
  }
}

type HermesWebUiRoutesOptions = {
  standaloneReachable?: boolean
  standaloneBlocker?: string | null
}

function buildHermesWebUiButtonContract(options: HermesWebUiRoutesOptions = {}) {
  const standaloneReachable = options.standaloneReachable === true
  const standaloneBlocker = options.standaloneBlocker || 'hermes_webui_health_not_proven'

  return [
    {
      label: 'Open Ron Weasley WebUI',
      href: standaloneReachable ? HERMES_STANDALONE_PROXY_ROUTE : null,
      api_route: '/api/bridge/hermes-webui/health',
      disabled_reason: standaloneReachable
        ? null
        : `${standaloneBlocker}; use the Mission Control Ron Weasley Command Center until the loopback WebUI health route is proven.`,
    },
    { label: 'Open Ron Weasley Command Center', href: HERMES_COMMAND_CENTER_ROUTE, api_route: '/api/bridge/hermes/status', disabled_reason: null },
    { label: 'Status', href: `${HERMES_WEB_INTERFACE_BASE}/status`, api_route: '/api/bridge/hermes-webui/status', disabled_reason: null },
    { label: 'Routes', href: `${HERMES_WEB_INTERFACE_BASE}/routes`, api_route: '/api/bridge/hermes-webui/routes', disabled_reason: null },
    { label: 'Brain Map', href: `${HERMES_WEB_INTERFACE_BASE}/brain-map`, api_route: '/api/bridge/hermes/brain-map', disabled_reason: null },
    { label: 'Tool Map', href: `${HERMES_WEB_INTERFACE_BASE}/tool-map`, api_route: '/api/bridge/hermes/tool-map', disabled_reason: null },
    { label: 'Skill Registry', href: `${HERMES_WEB_INTERFACE_BASE}/skill-registry`, api_route: '/api/bridge/hermes/skill-registry', disabled_reason: null },
    { label: 'Mini-Agent Registry', href: `${HERMES_WEB_INTERFACE_BASE}/mini-agent-registry`, api_route: '/api/bridge/hermes/mini-agent-registry', disabled_reason: null },
    { label: 'Dispatch Plan', href: `${HERMES_WEB_INTERFACE_BASE}/dispatch-plan`, api_route: '/api/bridge/hermes/dispatch-plan', disabled_reason: null },
    { label: 'Request Jarvis Concurrence', href: `${HERMES_WEB_INTERFACE_BASE}/jarvis-concurrence`, api_route: '/api/bridge/hermes/jarvis-concurrence-request', disabled_reason: null },
    { label: 'View Pipeline', href: `${HERMES_WEB_INTERFACE_BASE}/pipelines`, api_route: '/api/bridge/hermes-webui/status', disabled_reason: null },
    { label: 'View Audit', href: `${HERMES_WEB_INTERFACE_BASE}/logs`, api_route: '/api/bridge/hermes-webui/status', disabled_reason: null },
    { label: 'Trace Direct Line', href: `${HERMES_WEB_INTERFACE_BASE}/routes`, api_route: '/api/bridge/hermes-webui/identity', disabled_reason: null },
  ]
}

export function buildHermesWebUiRoutes(options: HermesWebUiRoutesOptions = {}) {
  return {
    route: 'bridge.hermes-webui.routes',
    canonical_name: RON_WEASLEY_IDENTITY.canonical_name,
    short_name: RON_WEASLEY_IDENTITY.short_name,
    full_title: RON_WEASLEY_IDENTITY.full_title,
    legacy_names: RON_WEASLEY_IDENTITY.legacy_names,
    mission_control_pages: [...HERMES_WEBUI_MISSION_CONTROL_PAGES],
    legacy_mission_control_page_aliases: [...HERMES_WEBUI_LEGACY_MISSION_CONTROL_PAGES],
    required_ui_sections: [...HERMES_WEBUI_REQUIRED_UI_SECTIONS],
    webui_routes: {
      preflight: '/api/bridge/hermes-webui/preflight',
      identity: '/api/bridge/hermes-webui/identity',
      status: '/api/bridge/hermes-webui/status',
      health: '/api/bridge/hermes-webui/health',
      routes: '/api/bridge/hermes-webui/routes',
      legacy_status_alias: '/api/bridge/hermes/webui/status',
    },
    hermes_control_plane_routes: [
      '/api/bridge/hermes/status',
      '/api/bridge/hermes/readiness',
      '/api/bridge/hermes/capability-map',
      '/api/bridge/hermes/authority',
      '/api/bridge/hermes/brain-map',
      '/api/bridge/hermes/tool-map',
      '/api/bridge/hermes/skill-registry',
      '/api/bridge/hermes/mini-agent-registry',
      '/api/bridge/hermes/recommendation',
      '/api/bridge/hermes/dispatch-plan',
      '/api/bridge/hermes/skill-draft',
      '/api/bridge/hermes/workflow-draft',
      '/api/bridge/hermes/jarvis-concurrence-request',
    ],
    button_contract: buildHermesWebUiButtonContract(options),
    fake_buttons_allowed: false,
    credential_values_exposed: false,
  }
}

export async function buildHermesWebUiStatus() {
  const local_url = configuredUrl()
  const repo = localRepoStatus()
  const probe = await probeHealth(local_url)

  return {
    route: 'bridge.hermes.webui.status',
    service: 'Ron Weasley WebUI',
    canonical_name: RON_WEASLEY_IDENTITY.canonical_name,
    short_name: RON_WEASLEY_IDENTITY.short_name,
    full_title: RON_WEASLEY_IDENTITY.full_title,
    legacy_names: RON_WEASLEY_IDENTITY.legacy_names,
    repo_url: REPO_URL,
    local_url,
    browser_url: getHermesWebUiBrowserUrl(),
    state: probe.state,
    webui_repo_present: repo.present,
    webui_repo_path: repo.path,
    health_reachable: probe.reachable,
    health_status_code: probe.status_code,
    direct_line_surface: true,
    mission_control_intermediary: false,
    openclaw_in_path: false,
    claudeclaw_in_path: false,
    auth_required: true,
    public_exposure_created: false,
    credential_values_exposed: false,
    writes_enabled: false,
    button_contract: buildHermesWebUiButtonContract({
      standaloneReachable: probe.reachable,
      standaloneBlocker: probe.exact_blocker,
    }),
    exact_blocker: probe.reachable ? null : probe.exact_blocker,
    next_action: probe.reachable
      ? 'Open Ron Weasley WebUI through the Mission Control authenticated proxy; the backing service remains loopback-only.'
      : 'Start Ron Weasley WebUI on 127.0.0.1:8787 from the To-Knowledge-hermes-webui repo or set HERMES_WEBUI_URL to another loopback URL.',
    rollback_command: 'Remove the Ron Weasley WebUI link/status registration; no external state, credentials, public exposure, or production writes were created.',
  }
}

export async function buildHermesWebUiHealth() {
  const status = await buildHermesWebUiStatus()
  return {
    ...status,
    route: 'bridge.hermes-webui.health',
    status: status.health_reachable ? 'RUNNING' : 'SERVICE_DOWN',
    labels: [
      status.health_reachable ? 'RUNNING' : 'SERVICE_DOWN',
      'TAILNET_ONLY',
      'DIRECT_LINE_ACTIVE',
      'JARVIS_CONCURRENCE_REQUIRED',
    ],
  }
}
