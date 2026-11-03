import type { NitroHooks, RequestEvent } from './utils/nitro'
import http2 from 'node:http2'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import plugin from '../src/runtime/nitro'
import { portOf } from './utils/net'
import { createRequestEvent, startNitroPlugin } from './utils/nitro'

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

const server = http2.createServer()
server.on('stream', (stream: http2.ServerHttp2Stream) => {
  setTimeout(() => {
    stream.respond({ ':status': 200 })
    stream.end('http2 ok')
  }, 30)
})
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const port = portOf(server)

let hooks: NitroHooks

beforeEach(() => {
  hooks = startNitroPlugin(plugin)
})

afterEach(async () => {
  await hooks.callHook('close')
})

afterAll(() => new Promise<void>((resolve) => {
  server.close(() => resolve())
}))

describe('http2 transport', () => {
  it('serves http2 requests while outbound collection is enabled', async () => {
    const current = createRequestEvent()
    const body = await runtime.context.run(current, async () => {
      await hooks.callHook('request', current)
      const session = http2.connect(`http://127.0.0.1:${port}`)
      session.setTimeout(2000)
      try {
        return await new Promise<string>((resolve, reject) => {
          const request = session.request({ ':path': '/', ':method': 'GET' })
          let received = ''
          request.on('data', (chunk) => {
            received += chunk
          })
          request.on('end', () => resolve(received))
          request.on('error', reject)
          session.on('timeout', () => reject(new Error('http2 session timed out')))
          request.end()
        })
      }
      finally {
        session.destroy()
      }
    })

    expect(body).toBe('http2 ok')
    const timings = Object.values(current.context.prometheus.requests)
    expect(timings).toHaveLength(1)
    expect(timings[0]!.end - timings[0]!.start).toBeGreaterThanOrEqual(20)
  })
})
