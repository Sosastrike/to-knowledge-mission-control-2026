import { describe, expect, it } from 'vitest'

import { listJarvisAdapters } from '@/lib/jarvis-adapter-registry'
import { buildJarvisSystemCommandRegistry } from '@/lib/jarvis-system-command-registry'
import {
  PUBLIC_WEBPAGE_READ_ACTION,
  PUBLIC_WEBPAGE_READ_ADAPTER_ID,
  YOUTUBE_TRANSCRIPT_ACTION,
  YOUTUBE_TRANSCRIPT_ADAPTER_ID,
} from '@/lib/public-research'

describe('Jarvis public research and video intelligence registry', () => {
  it('registers public webpage and YouTube transcript as read-only executable adapters', () => {
    const adapters = listJarvisAdapters()
    expect(adapters.find((adapter) => adapter.id === PUBLIC_WEBPAGE_READ_ADAPTER_ID)).toMatchObject({
      status: 'ready_read_only',
      execution_enabled: true,
      credential_values_exposed: false,
    })
    expect(adapters.find((adapter) => adapter.id === YOUTUBE_TRANSCRIPT_ADAPTER_ID)).toMatchObject({
      status: 'ready_read_only',
      execution_enabled: true,
      credential_values_exposed: false,
    })
  })

  it('exposes Jarvis command-registry entries without credential requirements', () => {
    const registry = buildJarvisSystemCommandRegistry()
    expect(registry.commands.find((command) => command.command_id === PUBLIC_WEBPAGE_READ_ACTION)).toMatchObject({
      adapter_id: PUBLIC_WEBPAGE_READ_ADAPTER_ID,
      command_status: 'certified',
      credential_required: false,
      write: false,
      execute: true,
    })
    expect(registry.commands.find((command) => command.command_id === YOUTUBE_TRANSCRIPT_ACTION)).toMatchObject({
      adapter_id: YOUTUBE_TRANSCRIPT_ADAPTER_ID,
      command_status: 'certified',
      credential_required: false,
      write: false,
      execute: true,
    })
  })
})
