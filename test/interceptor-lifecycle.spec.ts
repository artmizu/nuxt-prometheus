import type { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest'
import type { FetchInterceptor } from '@mswjs/interceptors/fetch'
import type { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest'
import type { NitroApp, NitroRuntimeHooks } from 'nitropack/types'
import type { AddressInfo } from 'node:net'
import http, { createServer } from 'node:http'
import { BatchInterceptor } from '@mswjs/interceptors'
import { createHooks } from 'hookable'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import plugin from '../src/runtime/nitro'
import { calculateTime } from '../src/runtime/utils'

type RequestEvent = Parameters<NitroRuntimeHooks['request']>[0]

const runtime = await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import('node:async_hooks')
  return {
    context: new AsyncLocalStorage<RequestEvent>(),
    params: { enabled: true, verbose: false, disableRequestInterceptor: false },
  }
})

vi.mock('nitropack/runtime', () => ({
  defineNitroPlugin: (callback: unknown) => callback,
  useRuntimeConfig: () => ({
    public: { prometheus: runtime.params },
  }),
  useEvent: () => {
    const event = runtime.context.getStore()
    if (!event)
      throw new Error('Nitro request context is not available')
    return event
  },
}))

let apply = vi.spyOn(BatchInterceptor.prototype, 'apply')
let hooks: ReturnType<typeof createHooks<NitroRuntimeHooks>>
type RequestInterceptor = BatchInterceptor<[ClientRequestInterceptor, FetchInterceptor, XMLHttpRequestInterceptor]>
let interceptor: RequestInterceptor

function event() {
  return { context: {} } as RequestEvent
}

let raceCount = 0
const upstream = createServer((request, response) => {
  if (request.url === '/race') {
    return raceCount++ === 0
      ? setTimeout(() => response.end('slow'), 150)
      : setTimeout(() => response.end('fast'), 15)
  }

  response.end('ok')
})
upstream.on('checkContinue', (request, response) => {
  response.writeContinue()
  setTimeout(() => response.end('continued'), 80)
})
await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve))

function upstreamPort() {
  return (upstream.address() as AddressInfo).port
}

function listenerCounts() {
  const { emitter } = interceptor as unknown as {
    emitter: { listenerCount: (name: string) => number }
  }
  return {
    request: emitter.listenerCount('request'),
    response: emitter.listenerCount('response'),
  }
}

beforeEach(() => {
  apply = vi.spyOn(BatchInterceptor.prototype, 'apply')
  raceCount = 0
  runtime.params.disableRequestInterceptor = false
  hooks = createHooks<NitroRuntimeHooks>()
  plugin({ hooks } as unknown as NitroApp)
  interceptor = apply.mock.instances[0]! as RequestInterceptor
})

afterEach(async () => {
  await hooks.callHook('close')
  vi.restoreAllMocks()
})

afterAll(() => new Promise<void>((resolve) => {
  upstream.closeAllConnections()
  upstream.close(() => resolve())
}))

describe('interceptor request lifecycle', () => {
  it('keeps listener counts constant when requests never reach cleanup hooks', async () => {
    const initial = listenerCounts()
    for (let i = 0; i < 1000; i++) {
      const current = event()
      await runtime.context.run(current, () => hooks.callHook('request', current))
    }

    expect(listenerCounts()).toEqual(initial)
    expect(initial).toEqual({ request: 1, response: 1 })
  })

  it('isolates outbound request and response timings between concurrent requests', async () => {
    let now = 100
    vi.spyOn(Date, 'now').mockImplementation(() => now++)
    interceptor.on('request', ({ controller }) => {
      controller.respondWith(new Response('ok'))
    })

    const events = await Promise.all(Array.from({ length: 50 }, (_, i) => {
      const current = event()
      return runtime.context.run(current, async () => {
        await hooks.callHook('request', current)
        await Promise.resolve()
        await fetch(`http://api.test/request-${i}`)
        return current
      })
    }))

    events.forEach((current) => {
      expect(Object.keys(current.context.prometheus.requests)).toHaveLength(1)
      const [timing] = Object.values(current.context.prometheus.requests)
      expect(timing!.end).toBeGreaterThan(timing!.start)
    })
  })

  it('does not finish timing on informational responses', async () => {
    const current = event()
    await runtime.context.run(current, async () => {
      await hooks.callHook('request', current)
      await new Promise<void>((resolve, reject) => {
        const request = http.request({
          host: '127.0.0.1',
          port: upstreamPort(),
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
    })

    expect(calculateTime(current.context.prometheus).request).toBeGreaterThanOrEqual(60)
  })

  it('keeps both timings for concurrent calls to the same url', async () => {
    const current = event()
    await runtime.context.run(current, async () => {
      await hooks.callHook('request', current)
      const url = `http://127.0.0.1:${upstreamPort()}/race`
      await Promise.all([
        fetch(url),
        fetch(url),
      ])
    })

    expect(Object.values(current.context.prometheus.requests)).toHaveLength(2)
    expect(calculateTime(current.context.prometheus).request).toBeGreaterThanOrEqual(130)
  })

  it('does not break background calls or calls before metrics state exists', async () => {
    interceptor.on('request', ({ controller }) => {
      controller.respondWith(new Response('ok'))
    })

    expect(await (await fetch('http://api.test/background')).text()).toBe('ok')
    const current = event()
    await runtime.context.run(current, async () => {
      expect(await (await fetch('http://api.test/early')).text()).toBe('ok')
    })
    expect(current.context.prometheus).toBeUndefined()
    expect(() => hooks.callHook('afterResponse', current)).not.toThrow()
  })

  it('ignores internal Nuxt requests', async () => {
    interceptor.on('request', ({ controller }) => {
      controller.respondWith(new Response('ok'))
    })

    const current = event()
    await runtime.context.run(current, async () => {
      await hooks.callHook('request', current)
      await fetch('http://api.test/__nuxt_island/component')
    })

    expect(current.context.prometheus.requests).toEqual({})
  })

  it('removes all listeners on shutdown', async () => {
    await hooks.callHook('close')
    expect(listenerCounts()).toEqual({ request: 0, response: 0 })
  })

  it('does not apply or bind the interceptor when disabled', async () => {
    await hooks.callHook('close')
    runtime.params.disableRequestInterceptor = true
    apply.mockClear()
    hooks = createHooks<NitroRuntimeHooks>()
    plugin({ hooks } as unknown as NitroApp)

    const current = event()
    await hooks.callHook('request', current)

    expect(apply).not.toHaveBeenCalled()
    expect(listenerCounts()).toEqual({ request: 0, response: 0 })
  })
})
