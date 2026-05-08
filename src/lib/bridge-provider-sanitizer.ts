const RAW_LOCAL_PATH_PATTERN = /(?:\/home\/tony|\/Users\/[^\s"'`),}\]]+|\/Volumes\/[^\s"'`),}\]]+|\/tmp\/[^\s"'`),}\]]+|\/var\/folders\/[^\s"'`),}\]]+)[^\s"'`),}\]]*/gi
const SECRET_VALUE_PATTERN = /(sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY)\s*[:=]\s*[^,\s}]+)/gi

export function sanitizeBridgeProviderPayload<T>(value: T): T {
  if (typeof value === 'string') {
    return value
      .replace(RAW_LOCAL_PATH_PATTERN, '<redacted-path>')
      .replace(SECRET_VALUE_PATTERN, '<redacted-secret>') as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeBridgeProviderPayload(item)) as T
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (/(?:secret|token|password|api[_-]?key)$/i.test(key) && typeof nested === 'string') {
        output[key] = '<redacted-secret>'
      } else {
        output[key] = sanitizeBridgeProviderPayload(nested)
      }
    }
    return output as T
  }

  return value
}
