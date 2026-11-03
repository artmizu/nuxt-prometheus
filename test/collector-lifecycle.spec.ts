import type { NitroApp, NitroRuntimeHooks } from 'nitropack/types'
import type { AddressInfo } from 'node:net'
import http, { createServer } from 'node:http'
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

function event() {
  return { context: {} } as RequestEvent
}

const upstream = createServer((request, response) => {
  if (request.url === '/slow') {
    return setTimeout(() => response.end('slow'), 60)
  }
  response.end('ok')
})
upstream.on('checkContinue', (request, response) => {
  response.writeContinue()
  setTimeout(() => response.end('continued'), 60)
})
await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve))

function upstreamUrl(path: string) {
  return `http://127.0.0.1:${(upstream.address() as AddressInfo).port}${path}`
}

let hooks: ReturnType<typeof createHooks<NitroRuntimeHooks>>

beforeEach(() => {
  runtime.params.disableRequestInterceptor = false
  hooks = createHooks<NitroRuntimeHooks>()
  plugin({ hooks } as unknown as NitroApp)
})

afterEach(async () => {
  await hooks.callHook('close')
})

afterAll(() => new Promise<void>((resolve) => {
  upstream.closeAllConnections()
  upstream.close(() => resolve())
}))

function request(path: string) {
  return new Promise<void>((resolve, reject) => {
    http.get(upstreamUrl(path), (response) => {
      response.resume()
      response.on('end', resolve)
    }).on('error', reject)
  })
}

describe('outbound request collection', () => {
  it('records outbound fetch and http timings for the current request', async () => {
    const current = event()
    await runtime.context.run(current, async () => {
      await hooks.callHook('request', current)
      await fetch(upstreamUrl('/fetch'))
      await request('/http')
    })

    const timings = Object.values(current.context.prometheus.requests)
    expect(timings).toHaveLength(2)
    for (const timing of timings) {
      expect(timing.start).toBeTypeOf('number')
      expect(timing.end).toBeGreaterThanOrEqual(timing.start)
    }
  })

  it('isolates outbound timings between concurrent requests', async () => {
    const events = await Promise.all(Array.from({ length: 50 }, (_, i) => {
      const current = event()
      return runtime.context.run(current, async () => {
        await hooks.callHook('request', current)
        await fetch(upstreamUrl(`/request-${i}`))
        return current
      })
    }))

    events.forEach((current) => {
      expect(Object.keys(current.context.prometheus.requests)).toHaveLength(1)
      const [timing] = Object.values(current.context.prometheus.requests)
      expect(timing!.end).toBeGreaterThanOrEqual(timing!.start)
    })
  })

  it('does not finish timing on informational responses', async () => {
    const current = event()
    await runtime.context.run(current, async () => {
      await hooks.callHook('request', current)
      await new Promise<void>((resolve, reject) => {
        const request = http.request({
          host: '127.0.0.1',
          port: (upstream.address() as AddressInfo).port,
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

    expect(calculateTime(current.context.prometheus).request).toBeGreaterThanOrEqual(50)
  })

  it('keeps both timings for concurrent calls to the same url', async () => {
    const current = event()
    await runtime.context.run(current, async () => {
      await hooks.callHook('request', current)
      await Promise.all([
        fetch(upstreamUrl('/race')),
        fetch(upstreamUrl('/race')),
      ])
    })

    expect(Object.values(current.context.prometheus.requests)).toHaveLength(2)
  })

  it('does not break background calls or calls before metrics state exists', async () => {
    expect(await (await fetch(upstreamUrl('/background'))).text()).toBe('ok')
    const current = event()
    await runtime.context.run(current, async () => {
      expect(await (await fetch(upstreamUrl('/early'))).text()).toBe('ok')
    })
    expect(current.context.prometheus).toBeUndefined()
    expect(() => hooks.callHook('afterResponse', current)).not.toThrow()
  })

  it('ignores internal Nuxt requests', async () => {
    const current = event()
    await runtime.context.run(current, async () => {
      await hooks.callHook('request', current)
      await fetch(upstreamUrl('/__nuxt_island/component'))
    })

    expect(current.context.prometheus.requests).toEqual({})
  })

  it('does not accumulate state when requests never reach cleanup hooks', async () => {
    const current = event()
    await runtime.context.run(current, async () => {
      await hooks.callHook('request', current)
      for (let i = 0; i < 1000; i++)
        await Promise.resolve()
    })
    expect(current.context.prometheus.requests).toEqual({})

    const next = event()
    await runtime.context.run(next, async () => {
      await hooks.callHook('request', next)
      await fetch(upstreamUrl('/after-idle'))
    })
    expect(Object.values(next.context.prometheus.requests)).toHaveLength(1)
  })

  it('stops collecting after the close hook', async () => {
    await hooks.callHook('close')
    const current = event()
    await runtime.context.run(current, async () => {
      await hooks.callHook('request', current)
      await fetch(upstreamUrl('/closed'))
    })

    expect(current.context.prometheus.requests).toEqual({})
  })

  it('does not collect when interception is disabled', async () => {
    await hooks.callHook('close')
    runtime.params.disableRequestInterceptor = true
    hooks = createHooks<NitroRuntimeHooks>()
    plugin({ hooks } as unknown as NitroApp)

    const current = event()
    await runtime.context.run(current, async () => {
      await hooks.callHook('request', current)
      await fetch(upstreamUrl('/disabled'))
    })

    expect(current.context.prometheus.requests).toEqual({})
  })
})
