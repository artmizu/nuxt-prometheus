import type { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest'
import type { FetchInterceptor } from '@mswjs/interceptors/fetch'
import type { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest'
import type { NitroApp, NitroRuntimeHooks } from 'nitropack/types'
import { BatchInterceptor } from '@mswjs/interceptors'
import { createHooks } from 'hookable'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import plugin from '../src/runtime/nitro'

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
  useRuntimeConfig: () => ({ public: { prometheus: runtime.params } }),
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

function listenerCounts() {
  return {
    request: interceptor.listenerCount('request'),
    response: interceptor.listenerCount('response'),
  }
}

beforeEach(() => {
  apply = vi.spyOn(BatchInterceptor.prototype, 'apply')
  runtime.params.disableRequestInterceptor = false
  hooks = createHooks<NitroRuntimeHooks>()
  plugin({ hooks } as unknown as NitroApp)
  interceptor = apply.mock.instances[0]! as RequestInterceptor
})

afterEach(async () => {
  await hooks.callHook('close')
  vi.restoreAllMocks()
})

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

    events.forEach((current, i) => {
      const url = `http://api.test/request-${i}`
      expect(Object.keys(current.context.prometheus.requests)).toEqual([url])
      const timing = current.context.prometheus.requests[url]!
      expect(timing.end).toBeGreaterThan(timing.start)
    })
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
