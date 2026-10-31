import type { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest'
import type { FetchInterceptor } from '@mswjs/interceptors/fetch'
import type { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest'
import type { H3Event } from 'h3'
import type { NitroApp, NitroRuntimeHooks } from 'nitropack/types'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { BatchInterceptor } from '@mswjs/interceptors'
import { createEvent } from 'h3'
import { createHooks } from 'hookable'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import plugin from '../src/runtime/nitro'

const runtime = await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import('node:async_hooks')
  return {
    context: new AsyncLocalStorage<H3Event>(),
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
  const req = new IncomingMessage(new Socket())
  return createEvent(req, new ServerResponse(req))
}

function listenerCounts() {
  const children = (interceptor as unknown as {
    interceptors: { emitter: { listenerCount: (name: string) => number } }[]
  }).interceptors
  return children.map(child => ({
    request: child.emitter.listenerCount('request'),
    response: child.emitter.listenerCount('response'),
  }))
}

beforeEach(() => {
  apply = vi.spyOn(BatchInterceptor.prototype, 'apply')
  runtime.params.disableRequestInterceptor = false
  hooks = createHooks<NitroRuntimeHooks>()
  plugin({ hooks } as NitroApp)
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
    expect(initial.some(count => count.request > 0 && count.response > 0)).toBe(true)
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
    await expect(hooks.callHook('afterResponse', current)).resolves.toBeUndefined()
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
    expect(listenerCounts()).toEqual([
      { request: 0, response: 0 },
      { request: 0, response: 0 },
      { request: 0, response: 0 },
    ])
  })

  it('does not apply or bind the interceptor when disabled', async () => {
    await hooks.callHook('close')
    runtime.params.disableRequestInterceptor = true
    apply.mockClear()
    hooks = createHooks<NitroRuntimeHooks>()
    plugin({ hooks } as NitroApp)

    const current = event()
    await hooks.callHook('request', current)

    expect(apply).not.toHaveBeenCalled()
    expect(listenerCounts().every(count => count.request === 0 && count.response === 0)).toBe(true)
  })
})
