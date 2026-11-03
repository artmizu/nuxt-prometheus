import type { NitroApp, NitroRuntimeHooks } from 'nitropack/types'
import { Buffer } from 'node:buffer'
import { credentials, makeGenericClientConstructor, Server, ServerCredentials } from '@grpc/grpc-js'
import { createHooks } from 'hookable'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

const serialize = (value: unknown) => Buffer.from(JSON.stringify(value))
const deserialize = (buffer: Buffer) => JSON.parse(buffer.toString())

const service = {
  Say: {
    path: '/demo.Greeter/Say',
    requestStream: false,
    responseStream: false,
    requestSerialize: serialize,
    requestDeserialize: deserialize,
    responseSerialize: serialize,
    responseDeserialize: deserialize,
  },
}

const server = new Server()
server.addService(service, {
  Say: (call: { request: { name: string } }, callback: (error: null, response: { message: string }) => void) => {
    callback(null, { message: `hello ${call.request.name}` })
  },
} as never)

const address = await new Promise<string>((resolve, reject) => {
  server.bindAsync('127.0.0.1:0', ServerCredentials.createInsecure(), (error, port) => {
    if (error)
      reject(error)
    else
      resolve(`127.0.0.1:${port}`)
  })
})

const Client = makeGenericClientConstructor(service, 'Greeter')

let hooks: ReturnType<typeof createHooks<NitroRuntimeHooks>>

beforeEach(() => {
  hooks = createHooks<NitroRuntimeHooks>()
  plugin({ hooks } as unknown as NitroApp)
})

afterEach(async () => {
  await hooks.callHook('close')
})

afterAll(() => {
  server.forceShutdown()
})

describe('grpc transport', () => {
  it('completes a unary grpc call while outbound collection is enabled', async () => {
    const current = { context: {} } as RequestEvent
    const result = await runtime.context.run(current, async () => {
      await hooks.callHook('request', current)
      const client = new Client(address, credentials.createInsecure()) as unknown as {
        Say: (request: { name: string }, options: { deadline: number }, callback: (error: Error | null, response?: { message: string }) => void) => void
        close: () => void
      }
      try {
        return await new Promise<{ message: string }>((resolve, reject) => {
          client.Say({ name: 'world' }, { deadline: Date.now() + 3000 }, (error, response) => {
            if (error)
              reject(error)
            else
              resolve(response!)
          })
        })
      }
      finally {
        client.close()
      }
    })

    expect(result).toEqual({ message: 'hello world' })
    expect(current.context.prometheus.requests).toEqual({})
  })
})
