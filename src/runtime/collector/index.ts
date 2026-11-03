import type { OutboundCollector, OutboundCollectorOptions } from './types'
import { createChannelsCollector } from './adapters/channels'
import { createWrappersCollector } from './adapters/wrappers'

type RuntimeName = 'bun' | 'deno' | 'node'

export function detectRuntime(): RuntimeName {
  if ('Bun' in globalThis)
    return 'bun'
  if ('Deno' in globalThis)
    return 'deno'
  return 'node'
}

export function createOutboundCollector(options: OutboundCollectorOptions): OutboundCollector {
  return detectRuntime() === 'node'
    ? createChannelsCollector(options)
    : createWrappersCollector(options)
}
