import type { NitroApp, NitroRuntimeHooks } from 'nitropack/types'
import type { AddressInfo } from 'node:net'
import http, { createServer } from 'node:http'
import { createHooks } from 'hookable'
import { afterAll, describe, expect, it, vi } from 'vitest'
import plugin from '../src/runtime/nitro'

vi.mock('nitropack/runtime', () => ({
  defineNitroPlugin: (callback: unknown) => callback,
  useRuntimeConfig: () => ({
    public: {
      prometheus: {
        enabled: true,
        verbose: false,
        disableRequestInterceptor: false,
      },
    },
  }),
  useEvent: () => {
    throw new Error('Nitro request context is not available')
  },
}))

const seen: unknown[][] = []
const originalRequest = http.request
http.request = function (...args: unknown[]) {
  seen.push(args)
  return Reflect.apply(originalRequest, this, args)
}

const server = createServer((_request, response) => response.end('ok'))
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const port = (server.address() as AddressInfo).port

const hooks = createHooks<NitroRuntimeHooks>()
plugin({ hooks } as unknown as NitroApp)

afterAll(async () => {
  await hooks.callHook('close')
  http.request = originalRequest
  server.closeAllConnections()
  await new Promise<void>(resolve => server.close(() => resolve()))
})

function request(target: string | http.RequestOptions) {
  return new Promise<void>((resolve, reject) => {
    const onResponse = (response: http.IncomingMessage) => {
      response.resume()
      response.on('end', resolve)
    }
    const outgoing = typeof target === 'string'
      ? http.request(new URL(target), { method: 'GET' }, onResponse)
      : http.request(target, onResponse)
    outgoing.on('error', reject)
    outgoing.end()
  })
}

describe('request patches installed before the interceptor', () => {
  it('keeps the options-first call shape used by Application Insights', async () => {
    await request({
      host: '127.0.0.1',
      port,
      path: '/options-first',
      headers: { 'x-test': '1' },
      disableAppInsightsAutoCollection: true,
    } as http.RequestOptions)

    expect(seen).toHaveLength(1)
    expect(seen[0]!).toHaveLength(2)
    expect(seen[0]![0]).not.toBeInstanceOf(URL)
    expect(seen[0]![0]).toMatchObject({
      path: '/options-first',
      headers: { 'x-test': '1' },
      disableAppInsightsAutoCollection: true,
    })
  })

  it('keeps the url-first call shape', async () => {
    await request(`http://127.0.0.1:${port}/url-first`)

    expect(seen).toHaveLength(2)
    expect(seen[1]!).toHaveLength(3)
    expect(seen[1]![0]).toBeInstanceOf(URL)
  })
})
