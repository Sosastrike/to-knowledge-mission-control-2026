import fs from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ path?: string[] }>
}

const GATEWAY_DESIGN_ROOT_CANDIDATES = [
  process.env.GATEWAY_DESIGN_ROOT || '',
  path.join(process.cwd(), 'public', 'designer-mission-control', 'design', 'gateway'),
  path.join(process.cwd(), '.next', 'standalone', 'public', 'designer-mission-control', 'design', 'gateway'),
  '/home/tony/mission-control/public/designer-mission-control/design/gateway',
  '/home/tony/mission-control/.next/standalone/public/designer-mission-control/design/gateway',
].filter(Boolean)

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/jsx; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

async function firstExistingGatewayDesignRoot(): Promise<string | null> {
  for (const candidate of GATEWAY_DESIGN_ROOT_CANDIDATES) {
    try {
      const stat = await fs.stat(candidate)
      if (stat.isDirectory()) return candidate
    } catch {
      // Try the next candidate.
    }
  }
  return null
}

function safeRelativePath(segments: string[] = []): string | null {
  const decoded = segments.map((segment) => decodeURIComponent(segment))
  const joined = decoded.length > 0 ? decoded.join(path.sep) : 'index.html'
  const normalized = path.normalize(joined)

  if (path.isAbsolute(normalized) || normalized === '..' || normalized.startsWith(`..${path.sep}`)) {
    return null
  }

  return normalized
}

export async function GET(_request: Request, context: RouteContext) {
  const root = await firstExistingGatewayDesignRoot()
  if (!root) {
    return new NextResponse('Gateway design assets are not installed.', { status: 404 })
  }

  const params = await context.params
  const relativePath = safeRelativePath(params.path)
  if (!relativePath) {
    return new NextResponse('Invalid Gateway design asset path.', { status: 400 })
  }

  const filePath = path.join(root, relativePath)
  const resolvedRoot = path.resolve(root)
  const resolvedFile = path.resolve(filePath)
  if (resolvedFile !== resolvedRoot && !resolvedFile.startsWith(`${resolvedRoot}${path.sep}`)) {
    return new NextResponse('Invalid Gateway design asset path.', { status: 400 })
  }

  try {
    const stat = await fs.stat(resolvedFile)
    if (!stat.isFile()) {
      return new NextResponse('Gateway design asset not found.', { status: 404 })
    }

    const bytes = await fs.readFile(resolvedFile)
    const contentType = CONTENT_TYPES[path.extname(resolvedFile).toLowerCase()] || 'application/octet-stream'

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new NextResponse('Gateway design asset not found.', { status: 404 })
  }
}

export async function HEAD(_request: Request, context: RouteContext) {
  const response = await GET(_request, context)
  return new NextResponse(null, {
    status: response.status,
    headers: response.headers,
  })
}
