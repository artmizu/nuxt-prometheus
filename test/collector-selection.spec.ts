import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOutboundCollector } from '../src/runtime/collector'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('outbound collector selection', () => {
  it('keeps the global fetch untouched on Node', () => {
    const originalFetch = globalThis.fetch
    const collector = createOutboundCollector({
      getState: () => undefined,
    })
    collector.start()
    try {
      expect(globalThis.fetch).toBe(originalFetch)
    }
    finally {
      collector.stop()
    }
  })

  it.each(['Bun', 'Deno'])('wraps the global fetch on %s', (runtime) => {
    vi.stubGlobal(runtime, { version: 'test' })
    const originalFetch = globalThis.fetch
    const collector = createOutboundCollector({
      getState: () => undefined,
    })
    collector.start()
    try {
      expect(globalThis.fetch).not.toBe(originalFetch)
    }
    finally {
      collector.stop()
    }
    expect(globalThis.fetch).toBe(originalFetch)
  })
})
