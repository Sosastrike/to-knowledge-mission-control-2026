export const JARVIS_DRIVE_ONEDRIVE_UPLOAD_ADAPTER_ID = 'drive_onedrive_exact_upload'
export const JARVIS_DRIVE_ONEDRIVE_FOLDER_LIST_ACTION = 'drive_onedrive.folder_list'
export const JARVIS_DRIVE_ONEDRIVE_UPLOAD_ACTION = 'drive_onedrive.upload_file'
export const JARVIS_DRIVE_ONEDRIVE_UPLOAD_SESSION_SCOPE = 'drive_onedrive_approved_folder_upload'

export const JARVIS_DRIVE_ONEDRIVE_CREDENTIAL_NAMES = [
  'GOOGLE_DRIVE_ACCESS_TOKEN',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON',
  'ZAPIER_MCP_URL',
  'ZAPIER_ACCESS_TOKEN',
] as const

export const JARVIS_DRIVE_ONEDRIVE_APPROVED_FOLDER_ENV = {
  google_drive: {
    id: 'GOOGLE_DRIVE_APPROVED_FOLDER_ID',
    name: 'GOOGLE_DRIVE_APPROVED_FOLDER_NAME',
  },
} as const

type DriveOneDriveProvider = keyof typeof JARVIS_DRIVE_ONEDRIVE_APPROVED_FOLDER_ENV

type DriveOneDriveRequest = {
  action?: string
  scope?: Record<string, unknown>
  input?: Record<string, unknown>
  actor?: string
}

type ZapierMcpCallResult = {
  ok: boolean
  parsed: unknown
  exact_blocker: string | null
}

type DriveOneDriveDeps = {
  env?: Record<string, string | undefined>
  callTool?: (name: string, args: Record<string, unknown>) => Promise<ZapierMcpCallResult>
}

type ApprovedFolder = {
  provider: DriveOneDriveProvider
  folder_id_present: boolean
  folder_name: string
}

type VerifiedFolder = ApprovedFolder & {
  id: string | null
  folder_verified: boolean
}

export type JarvisDriveOneDriveExactActionResult = {
  ok: boolean
  adapter_id: typeof JARVIS_DRIVE_ONEDRIVE_UPLOAD_ADAPTER_ID
  action: string
  scope: Record<string, unknown>
  credential_names_checked: string[]
  credential_values_exposed: false
  execution_enabled: boolean
  writes_enabled: boolean
  external_state_changed: boolean
  approved_folders: ApprovedFolder[]
  folder_listed: boolean
  folder_verified: boolean
  upload_planned: boolean
  upload_created: boolean
  rollback_deleted: boolean
  uploaded_file_id_present: boolean
  uploaded_file_id_redacted: boolean
  provider: DriveOneDriveProvider | null
  file_name: string | null
  file_size_bytes: number | null
  rollback_kind: 'delete_exact_uploaded_file' | 'none'
  public_sharing_enabled: false
  broad_access_enabled: false
  broad_folder_access_enabled: false
  exact_blocker: string | null
}

function normalizeScope(scope: unknown) {
  return scope && typeof scope === 'object' && !Array.isArray(scope) ? scope as Record<string, unknown> : {}
}

function envValue(env: Record<string, string | undefined>, name: string) {
  return (env[name] || '').trim()
}

function envPresent(env: Record<string, string | undefined>, name: string) {
  return Boolean(envValue(env, name))
}

function hasCredential(env: Record<string, string | undefined>) {
  const hasDirectGoogleCredential = ['GOOGLE_DRIVE_ACCESS_TOKEN', 'GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON']
    .some((name) => envPresent(env, name))
  const hasZapierBroker = envPresent(env, 'ZAPIER_MCP_URL') && (envPresent(env, 'ZAPIER_ACCESS_TOKEN') || envPresent(env, 'ZAPIER_API_KEY'))
  return hasDirectGoogleCredential || hasZapierBroker
}

function approvedFolders(env: Record<string, string | undefined>): ApprovedFolder[] {
  return (Object.keys(JARVIS_DRIVE_ONEDRIVE_APPROVED_FOLDER_ENV) as DriveOneDriveProvider[])
    .map((provider) => {
      const folderConfig = JARVIS_DRIVE_ONEDRIVE_APPROVED_FOLDER_ENV[provider]
      const folderIdPresent = envPresent(env, folderConfig.id)
      const folderName = envValue(env, folderConfig.name)
      if (!folderIdPresent && !folderName) return null
      return {
        provider,
        folder_id_present: folderIdPresent,
        folder_name: folderName || 'approved-folder',
      }
    })
    .filter((folder): folder is ApprovedFolder => Boolean(folder))
}

function block(
  action: string,
  scope: Record<string, unknown>,
  exactBlocker: string,
  folders: ApprovedFolder[] = [],
  extra: Partial<JarvisDriveOneDriveExactActionResult> = {},
): JarvisDriveOneDriveExactActionResult {
  return {
    ok: false,
    adapter_id: JARVIS_DRIVE_ONEDRIVE_UPLOAD_ADAPTER_ID,
    action: action || 'unknown',
    scope,
    credential_names_checked: [...JARVIS_DRIVE_ONEDRIVE_CREDENTIAL_NAMES],
    credential_values_exposed: false,
    execution_enabled: false,
    writes_enabled: false,
    external_state_changed: false,
    approved_folders: folders,
    folder_listed: false,
    folder_verified: false,
    upload_planned: false,
    upload_created: false,
    rollback_deleted: false,
    uploaded_file_id_present: false,
    uploaded_file_id_redacted: false,
    provider: null,
    file_name: null,
    file_size_bytes: null,
    rollback_kind: 'none',
    public_sharing_enabled: false,
    broad_access_enabled: false,
    broad_folder_access_enabled: false,
    exact_blocker: exactBlocker,
    ...extra,
  }
}

function cleanFileName(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw || raw.includes('/') || raw.includes('\\') || raw.startsWith('.') || raw.length > 120) return null
  if (!/^[A-Za-z0-9._ -]+$/.test(raw)) return null
  return raw
}

function cleanContent(value: unknown) {
  const raw = typeof value === 'string' ? value : ''
  if (!raw.trim() || raw.length > 20_000) return null
  return raw
}

function parseMcpJsonResponse(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('{')) return JSON.parse(trimmed)
  for (const line of trimmed.split('\n')) {
    const normalized = line.trim()
    if (!normalized.startsWith('data:')) continue
    const data = normalized.slice(5).trim()
    if (data.startsWith('{')) return JSON.parse(data)
  }
  return null
}

function contentPayload(payload: unknown): unknown {
  const result = payload && typeof payload === 'object' ? (payload as { result?: unknown }).result : null
  if (!result || typeof result !== 'object') return payload
  const content = (result as { content?: Array<{ text?: string }> }).content
  const text = Array.isArray(content) ? content.find((item) => typeof item?.text === 'string')?.text : null
  if (!text) return payload
  try {
    return JSON.parse(text)
  } catch {
    return { raw_text: text }
  }
}

function zapierMcpUrl(env: Record<string, string | undefined>) {
  return envValue(env, 'ZAPIER_MCP_URL') || envValue(env, 'ZAPIER_MCP_SERVER')
}

function zapierMcpToken(env: Record<string, string | undefined>) {
  return envValue(env, 'ZAPIER_ACCESS_TOKEN') || envValue(env, 'ZAPIER_API_KEY')
}

async function defaultZapierToolCall(env: Record<string, string | undefined>, name: string, args: Record<string, unknown>): Promise<ZapierMcpCallResult> {
  const url = zapierMcpUrl(env)
  const token = zapierMcpToken(env)
  if (!url || !token) return { ok: false, parsed: null, exact_blocker: 'google_drive_zapier_broker_missing' }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `jarvis-drive-${Date.now()}`,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    })
    const payload = parseMcpJsonResponse(await response.text())
    const parsed = contentPayload(payload)
    const hasError = Boolean(payload && typeof payload === 'object' && (payload as { error?: unknown }).error)
    if (!response.ok || hasError) return { ok: false, parsed, exact_blocker: 'google_drive_zapier_tool_call_failed' }
    return { ok: true, parsed, exact_blocker: null }
  } catch {
    return { ok: false, parsed: null, exact_blocker: 'google_drive_zapier_tool_call_failed' }
  }
}

function findObjectWithId(payload: unknown, predicate: (item: Record<string, unknown>) => boolean): Record<string, unknown> | null {
  const seen = new Set<unknown>()
  const visit = (node: unknown): Record<string, unknown> | null => {
    if (!node || typeof node !== 'object' || seen.has(node)) return null
    seen.add(node)
    if (!Array.isArray(node)) {
      const record = node as Record<string, unknown>
      if (typeof record.id === 'string' && predicate(record)) return record
      for (const value of Object.values(record)) {
        const found = visit(value)
        if (found) return found
      }
      return null
    }
    for (const item of node) {
      const found = visit(item)
      if (found) return found
    }
    return null
  }
  return visit(payload)
}

function titleOf(record: Record<string, unknown>) {
  return String(record.title || record.name || record.fileName || '').trim()
}

async function verifyFolder(
  folder: ApprovedFolder,
  callTool: (name: string, args: Record<string, unknown>) => Promise<ZapierMcpCallResult>,
): Promise<{ folder: VerifiedFolder | null; blocker: string | null }> {
  const byId = folder.folder_id_present
    ? await callTool('google_drive_retrieve_file_or_folder_by_id', {
      instructions: `Read-only verification. Retrieve only the approved Google Drive folder metadata for ${folder.folder_name}. Do not create, update, delete, share, or mutate anything.`,
      output_hint: 'Return only id, title, mimeType, and trashed state.',
      id: '__APPROVED_FOLDER_ID__',
    })
    : null

  // Some Zapier tools expect the real id in the field, so inject it only at the last possible boundary.
  if (byId && byId.exact_blocker !== 'google_drive_zapier_tool_call_failed') {
    const byIdFolder = findObjectWithId(byId.parsed, (item) => {
      const mimeType = String(item.mimeType || '')
      return mimeType === 'application/vnd.google-apps.folder' || titleOf(item).toLowerCase() === folder.folder_name.toLowerCase()
    })
    if (byIdFolder) {
      return {
        folder: { ...folder, id: String(byIdFolder.id), folder_verified: true },
        blocker: null,
      }
    }
  }

  const lookup = await callTool('google_drive_find_a_folder', {
    instructions: `Read-only verification. Find the existing Google Drive folder named ${folder.folder_name}. Do not create, update, delete, share, or mutate anything.`,
    output_hint: 'Return only id, title, mimeType, and trashed state for matching folders.',
    title: folder.folder_name,
    search_type: 'contains',
  })
  if (!lookup.ok) return { folder: null, blocker: lookup.exact_blocker || 'google_drive_folder_lookup_failed' }
  const found = findObjectWithId(lookup.parsed, (item) => {
    const mimeType = String(item.mimeType || '')
    const title = titleOf(item).toLowerCase()
    return mimeType === 'application/vnd.google-apps.folder' && title.includes(folder.folder_name.toLowerCase())
  })
  if (!found) return { folder: null, blocker: 'approved_google_drive_folder_not_found' }
  return {
    folder: { ...folder, id: String(found.id), folder_name: titleOf(found) || folder.folder_name, folder_verified: true },
    blocker: null,
  }
}

function withApprovedFolderId(
  env: Record<string, string | undefined>,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const id = envValue(env, JARVIS_DRIVE_ONEDRIVE_APPROVED_FOLDER_ENV.google_drive.id)
  if (args.id === '__APPROVED_FOLDER_ID__') return { ...args, id }
  return args
}

async function callWithEnv(
  env: Record<string, string | undefined>,
  deps: DriveOneDriveDeps,
  name: string,
  args: Record<string, unknown>,
): Promise<ZapierMcpCallResult> {
  const preparedArgs = withApprovedFolderId(env, args)
  return deps.callTool ? deps.callTool(name, preparedArgs) : defaultZapierToolCall(env, name, preparedArgs)
}

function uploadRecord(payload: unknown, fileName: string): Record<string, unknown> | null {
  return findObjectWithId(payload, (item) => {
    const title = titleOf(item)
    const mimeType = String(item.mimeType || '')
    return title === fileName || (!mimeType.includes('folder') && Boolean(title || item.webViewLink || item.alternateLink))
  })
}

function deleteSucceeded(payload: unknown) {
  const text = JSON.stringify(payload || {}).toLowerCase()
  return !/followupquestion|error|failed|not found|cannot/.test(text)
}

export async function executeJarvisDriveOneDriveExactAction(
  request: DriveOneDriveRequest,
  deps: DriveOneDriveDeps = {},
): Promise<JarvisDriveOneDriveExactActionResult> {
  const action = typeof request.action === 'string' ? request.action.trim() : ''
  const scope = normalizeScope(request.scope)
  const env = deps.env || process.env
  const folders = approvedFolders(env)

  const hasApprovedScope = hasCredential(env) && folders.length > 0
  if (!hasApprovedScope) {
    return block(action, scope, 'approved_folder_and_credential_scopes_missing', folders)
  }

  if (
    action !== JARVIS_DRIVE_ONEDRIVE_FOLDER_LIST_ACTION &&
    action !== JARVIS_DRIVE_ONEDRIVE_UPLOAD_ACTION
  ) {
    return block(action, scope, 'exact_scope_required_drive_onedrive_approved_folder', folders)
  }

  const providerFolder = folders.find((folder) => folder.provider === 'google_drive')
  if (!providerFolder) return block(action, scope, 'approved_folder_scope_missing_for_provider', folders)

  const callTool = (name: string, args: Record<string, unknown>) => callWithEnv(env, deps, name, args)
  const verified = await verifyFolder(providerFolder, callTool)
  if (!verified.folder) {
    return block(action, scope, verified.blocker || 'approved_google_drive_folder_not_found', folders)
  }
  const verifiedFolders: ApprovedFolder[] = [{
    provider: verified.folder.provider,
    folder_id_present: Boolean(verified.folder.id),
    folder_name: verified.folder.folder_name,
  }]

  if (
    action === JARVIS_DRIVE_ONEDRIVE_FOLDER_LIST_ACTION &&
    scope.connector === 'drive_onedrive' &&
    scope.operation === 'approved_folder_list'
  ) {
    return {
      ok: true,
      adapter_id: JARVIS_DRIVE_ONEDRIVE_UPLOAD_ADAPTER_ID,
      action: JARVIS_DRIVE_ONEDRIVE_FOLDER_LIST_ACTION,
      scope,
      credential_names_checked: [...JARVIS_DRIVE_ONEDRIVE_CREDENTIAL_NAMES],
      credential_values_exposed: false,
      execution_enabled: true,
      writes_enabled: false,
      external_state_changed: false,
      approved_folders: verifiedFolders,
      folder_listed: true,
      folder_verified: true,
      upload_planned: false,
      upload_created: false,
      rollback_deleted: false,
      uploaded_file_id_present: false,
      uploaded_file_id_redacted: false,
      provider: null,
      file_name: null,
      file_size_bytes: null,
      rollback_kind: 'none',
      public_sharing_enabled: false,
      broad_access_enabled: false,
      broad_folder_access_enabled: false,
      exact_blocker: null,
    }
  }

  if (
    action !== JARVIS_DRIVE_ONEDRIVE_UPLOAD_ACTION ||
    scope.connector !== 'drive_onedrive' ||
    scope.operation !== 'approved_folder_upload' ||
    scope.target !== 'single_test_file'
  ) {
    return block(action, scope, 'exact_scope_required_drive_onedrive_approved_folder', verifiedFolders)
  }

  const input = request.input && typeof request.input === 'object' && !Array.isArray(request.input) ? request.input : {}
  const provider = input.provider === 'google_drive' ? input.provider : null
  const fileName = cleanFileName(input.filename)
  const content = cleanContent(input.content)
  if (!provider || !fileName || !content) {
    return block(action, scope, 'exact_file_payload_required', verifiedFolders)
  }

  const upload = await callTool('google_drive_create_file_from_text', {
    instructions: `Create exactly one bounded Jarvis proof text file named ${fileName} in the approved Google Drive folder ${verified.folder.folder_name}. Do not share the file publicly. Do not create folders. Do not modify any other file.`,
    output_hint: 'Return only id, title, mimeType, webViewLink, and folder/parent id for the created file.',
    title: fileName,
    file: content,
    folder: verified.folder.id || verified.folder.folder_name,
    convert: false,
  })
  if (!upload.ok) return block(action, scope, upload.exact_blocker || 'google_drive_upload_failed', verifiedFolders)

  const uploaded = uploadRecord(upload.parsed, fileName)
  const uploadedFileId = typeof uploaded?.id === 'string' ? uploaded.id : null
  if (!uploadedFileId) {
    return block(action, scope, 'uploaded_file_id_missing_for_rollback', verifiedFolders, {
      external_state_changed: true,
      upload_planned: true,
      upload_created: true,
      provider,
      file_name: fileName,
      file_size_bytes: Buffer.byteLength(content, 'utf8'),
      rollback_kind: 'delete_exact_uploaded_file',
    })
  }

  const rollback = await callTool('google_drive_delete_file', {
    instructions: `Rollback Jarvis proof: delete only the exact Google Drive file named ${fileName} created in this same proof. Do not delete any other file or folder.`,
    output_hint: 'Return deletion status only.',
    fileId: uploadedFileId,
  })
  const rollbackDeleted = rollback.ok && deleteSucceeded(rollback.parsed)
  if (!rollbackDeleted) {
    return block(action, scope, rollback.exact_blocker || 'drive_rollback_delete_failed', verifiedFolders, {
      external_state_changed: true,
      upload_planned: true,
      upload_created: true,
      uploaded_file_id_present: true,
      uploaded_file_id_redacted: true,
      provider,
      file_name: fileName,
      file_size_bytes: Buffer.byteLength(content, 'utf8'),
      rollback_kind: 'delete_exact_uploaded_file',
    })
  }

  return {
    ok: true,
    adapter_id: JARVIS_DRIVE_ONEDRIVE_UPLOAD_ADAPTER_ID,
    action: JARVIS_DRIVE_ONEDRIVE_UPLOAD_ACTION,
    scope,
    credential_names_checked: [...JARVIS_DRIVE_ONEDRIVE_CREDENTIAL_NAMES],
    credential_values_exposed: false,
    execution_enabled: true,
    writes_enabled: true,
    external_state_changed: true,
    approved_folders: verifiedFolders,
    folder_listed: true,
    folder_verified: true,
    upload_planned: true,
    upload_created: true,
    rollback_deleted: true,
    uploaded_file_id_present: true,
    uploaded_file_id_redacted: true,
    provider,
    file_name: fileName,
    file_size_bytes: Buffer.byteLength(content, 'utf8'),
    rollback_kind: 'delete_exact_uploaded_file',
    public_sharing_enabled: false,
    broad_access_enabled: false,
    broad_folder_access_enabled: false,
    exact_blocker: null,
  }
}
