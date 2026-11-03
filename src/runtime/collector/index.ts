import type { OutboundCollector, OutboundCollectorOptions } from './types'
import { createChannelsCollector } from './adapters/channels'
import { createWrappersCollector } from './adapters/wrappers'

type RuntimeName = 'bun' | 'deno' | 'node'

interface RuntimeGlobals {
  Bun?: unknown
  Deno?: unknown
}

export function detectRuntime(globals: RuntimeGlobals = globalThis as RuntimeGlobals): RuntimeName {
  if (globals.Bun)
    return 'bun'
  if (globals.Deno)
    return 'deno'
  return 'node'
}

export function createOutboundCollector(options: OutboundCollectorOptions): OutboundCollector {
  return detectRuntime() === 'node'
    ? createChannelsCollector(options)
    : createWrappersCollector(options)
}

export type { OutboundCollector, OutboundCollectorOptions, OutboundRequestsState, OutboundRequestTiming } from './types'
