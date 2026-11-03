import type { NitroHooks, RequestEvent } from './utils/nitro'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import plugin from '../src/runtime/nitro'
import { callGreeter, startGreeterServer } from './utils/grpc'
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

const { server, address } = await startGreeterServer()

let hooks: NitroHooks

beforeEach(() => {
  hooks = startNitroPlugin(plugin)
})

afterEach(async () => {
  await hooks.callHook('close')
})

afterAll(() => {
  server.forceShutdown()
})

describe('grpc transport', () => {
  it('completes a unary grpc call while outbound collection is enabled', async () => {
    const current = createRequestEvent()
    const result = await runtime.context.run(current, async () => {
      await hooks.callHook('request', current)
      return await callGreeter(address)
    })

    expect(result).toEqual({ message: 'hello world' })
    const timings = Object.values(current.context.prometheus.requests)
    expect(timings).toHaveLength(1)
    expect(timings[0]!.end - timings[0]!.start).toBeGreaterThanOrEqual(20)
  })
})
