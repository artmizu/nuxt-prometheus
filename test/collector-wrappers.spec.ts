import type { ClientRequest } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { OutboundRequestsState } from '../src/runtime/collector/types'
import { AsyncLocalStorage } from 'node:async_hooks'
import http, { createServer } from 'node:http'
import { afterAll, describe, expect, it } from 'vitest'
import { createWrappersCollector } from '../src/runtime/collector/adapters/wrappers'

const upstream = createServer((request, response) => {
  setTimeout(() => response.end('ok'), 40)
})
upstream.on('checkContinue', (request, response) => {
  response.writeContinue()
  setTimeout(() => response.end('continued'), 60)
})
await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve))
const port = (upstream.address() as AddressInfo).port

const resetting = createServer((request, response) => {
  setTimeout(() => response.destroy(), 30)
})
await new Promise<void>(resolve => resetting.listen(0, '127.0.0.1', resolve))
const resettingPort = (resetting.address() as AddressInfo).port

afterAll(() => new Promise<void>((resolve) => {
  upstream.closeAllConnections()
  resetting.closeAllConnections()
  upstream.close(() => resetting.close(() => resolve()))
}))

function callOriginal(target: typeof http.request, self: unknown, args: unknown[]) {
  return (target as unknown as (...args: unknown[]) => ClientRequest).apply(self, args)
}

function setup() {
  const state: OutboundRequestsState = { requests: {} }
  const collector = createWrappersCollector({
    getState: () => state,
  })
  return { state, collector }
}

describe('wrappers collector', () => {
  it('records an outbound fetch request', async () => {
    const { state, collector } = setup()
    collector.start()
    await fetch(`http://127.0.0.1:${port}/fetch`)
    collector.stop()

    const timings = Object.values(state.requests)
    expect(timings).toHaveLength(1)
    expect(timings[0]!.end - timings[0]!.start).toBeGreaterThanOrEqual(30)
  })

  it('records an outbound http request', async () => {
    const { state, collector } = setup()
    collector.start()
    await new Promise<void>((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/http`, (response) => {
        response.resume()
        response.on('end', resolve)
      }).on('error', reject)
    })
    collector.stop()

    const timings = Object.values(state.requests)
    expect(timings).toHaveLength(1)
    expect(timings[0]!.end - timings[0]!.start).toBeGreaterThanOrEqual(30)
  })

  it('finishes the timing when the connection fails', async () => {
    const { state, collector } = setup()
    collector.start()
    await new Promise<void>((resolve) => {
      const request = http.get(`http://127.0.0.1:${resettingPort}/reset`, () => resolve())
      request.on('error', () => resolve())
    })
    collector.stop()

    const timings = Object.values(state.requests)
    expect(timings).toHaveLength(1)
    expect(timings[0]!.end - timings[0]!.start).toBeGreaterThanOrEqual(20)
  })

  it('does not finish the timing on informational responses', async () => {
    const { state, collector } = setup()
    collector.start()
    await new Promise<void>((resolve, reject) => {
      const request = http.request({
        host: '127.0.0.1',
        port,
        path: '/continue',
        method: 'POST',
        headers: { 'Expect': '100-continue', 'content-length': 1 },
      }, (response) => {
        response.resume()
        response.on('end', resolve)
      })
      request.on('error', reject)
      request.end('x')
    })
    collector.stop()

    const [timing] = Object.values(state.requests)
    expect(timing!.end - timing!.start).toBeGreaterThanOrEqual(50)
  })

  it('ignores internal Nuxt requests', async () => {
    const { state, collector } = setup()
    collector.start()
    await fetch(`http://127.0.0.1:${port}/__nuxt_island/component`)
    collector.stop()

    expect(state.requests).toEqual({})
  })

  it('records nothing without a request state', async () => {
    const collector = createWrappersCollector({
      getState: () => undefined,
    })
    collector.start()
    await fetch(`http://127.0.0.1:${port}/background`)
    collector.stop()

    expect(await (await fetch(`http://127.0.0.1:${port}/still-background`)).text()).toBe('ok')
  })

  it('does not count a request twice when started twice', async () => {
    const { state, collector } = setup()
    collector.start()
    collector.start()
    await fetch(`http://127.0.0.1:${port}/double-start`)
    collector.stop()

    expect(Object.values(state.requests)).toHaveLength(1)
  })

  it('keeps a patch installed after the collector on stop', async () => {
    const { collector } = setup()
    collector.start()
    const laterRequest = http.request
    const replacement = function replacement(this: unknown, ...args: unknown[]) {
      return callOriginal(laterRequest, this, args)
    } as unknown as typeof http.request
    http.request = replacement
    collector.stop()

    expect(http.request).toBe(replacement)
    http.request = laterRequest
  })

  it('preserves the caller argument shape for downstream patches', async () => {
    const seen: unknown[][] = []
    const original = http.request
    http.request = function recordingRequest(this: unknown, ...args: unknown[]) {
      seen.push(args)
      return callOriginal(original, this, args)
    } as unknown as typeof http.request

    const { collector } = setup()
    collector.start()
    try {
      await new Promise<void>((resolve, reject) => {
        const request = http.request({
          host: '127.0.0.1',
          port,
          path: '/options-first',
          headers: { 'x-test': '1' },
          disableAppInsightsAutoCollection: true,
        } as http.RequestOptions, (response) => {
          response.resume()
          response.on('end', resolve)
        })
        request.on('error', reject)
        request.end()
      })
    }
    finally {
      collector.stop()
      http.request = original
    }

    expect(seen).toHaveLength(1)
    expect(seen[0]).toHaveLength(2)
    expect(seen[0]![0]).not.toBeInstanceOf(URL)
    expect(seen[0]![0]).toMatchObject({ path: '/options-first', disableAppInsightsAutoCollection: true })
  })

  it('isolates concurrent requests of the same url', async () => {
    const { state, collector } = setup()
    collector.start()
    await Promise.all([
      fetch(`http://127.0.0.1:${port}/race`),
      fetch(`http://127.0.0.1:${port}/race`),
    ])
    collector.stop()

    expect(Object.values(state.requests)).toHaveLength(2)
  })

  it('attributes requests to the context that started them', async () => {
    const contexts = new AsyncLocalStorage<OutboundRequestsState>()
    const collector = createWrappersCollector({
      getState: () => contexts.getStore(),
    })
    const first: OutboundRequestsState = { requests: {} }
    const second: OutboundRequestsState = { requests: {} }
    collector.start()

    await contexts.run(first, () => fetch(`http://127.0.0.1:${port}/first`))
    await contexts.run(second, () => fetch(`http://127.0.0.1:${port}/second`))
    collector.stop()

    expect(Object.values(first.requests)).toHaveLength(1)
    expect(Object.values(second.requests)).toHaveLength(1)
  })

  it('restores the patched globals on stop', async () => {
    const originalFetch = globalThis.fetch
    const originalRequest = http.request
    const originalGet = http.get
    const { collector } = setup()
    collector.start()
    expect(globalThis.fetch).not.toBe(originalFetch)
    expect(http.request).not.toBe(originalRequest)
    expect(http.get).not.toBe(originalGet)
    collector.stop()
    expect(globalThis.fetch).toBe(originalFetch)
    expect(http.request).toBe(originalRequest)
    expect(http.get).toBe(originalGet)
  })
})
