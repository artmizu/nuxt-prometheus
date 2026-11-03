import type { AddressInfo } from 'node:net'
import type { OutboundRequestsState } from '../src/runtime/collector/types'
import { AsyncLocalStorage } from 'node:async_hooks'
import { Buffer } from 'node:buffer'
import http, { createServer } from 'node:http'
import http2 from 'node:http2'
import { credentials, makeGenericClientConstructor, Server, ServerCredentials } from '@grpc/grpc-js'
import { afterAll, describe, expect, it } from 'vitest'
import { createChannelsCollector } from '../src/runtime/collector/adapters/channels'

const upstream = createServer((request, response) => {
  if (request.url === '/missing') {
    response.statusCode = 404
    return response.end('missing')
  }
  setTimeout(() => response.end('ok'), 40)
})
const resetting = createServer((request, response) => {
  setTimeout(() => response.destroy(), 30)
})
await new Promise<void>(resolve => resetting.listen(0, '127.0.0.1', resolve))
const resettingPort = (resetting.address() as AddressInfo).port

upstream.on('checkContinue', (request, response) => {
  response.writeContinue()
  setTimeout(() => response.end('continued'), 60)
})
await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve))
const port = (upstream.address() as AddressInfo).port

const h2server = http2.createServer()
h2server.on('stream', (stream: http2.ServerHttp2Stream) => {
  setTimeout(() => {
    stream.respond({ ':status': 200 })
    stream.end('http2 ok')
  }, 40)
})
await new Promise<void>(resolve => h2server.listen(0, '127.0.0.1', resolve))
const h2port = (h2server.address() as AddressInfo).port

const grpcService = {
  Say: {
    path: '/demo.Greeter/Say',
    requestStream: false,
    responseStream: false,
    requestSerialize: (value: unknown) => Buffer.from(JSON.stringify(value)),
    requestDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString()),
    responseSerialize: (value: unknown) => Buffer.from(JSON.stringify(value)),
    responseDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString()),
  },
}
const grpcServer = new Server()
grpcServer.addService(grpcService, {
  Say: (call: { request: { name: string } }, callback: (error: null, response: { message: string }) => void) => {
    setTimeout(callback, 30, null, { message: `hello ${call.request.name}` })
  },
} as never)
const grpcAddress = await new Promise<string>((resolve, reject) => {
  grpcServer.bindAsync('127.0.0.1:0', ServerCredentials.createInsecure(), (error, port) => {
    if (error)
      reject(error)
    else
      resolve(`127.0.0.1:${port}`)
  })
})
const GreeterClient = makeGenericClientConstructor(grpcService, 'Greeter')

function http2Request() {
  return new Promise<string>((resolve, reject) => {
    const session = http2.connect(`http://127.0.0.1:${h2port}`)
    const request = session.request({ ':path': '/http2', ':method': 'GET' })
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('end', () => {
      session.close()
      resolve(body)
    })
    request.on('error', reject)
    request.end()
  })
}

function grpcCall() {
  return new Promise<{ message: string }>((resolve, reject) => {
    const client = new GreeterClient(grpcAddress, credentials.createInsecure()) as unknown as {
      Say: (request: { name: string }, options: { deadline: number }, callback: (error: Error | null, response?: { message: string }) => void) => void
      close: () => void
    }
    client.Say({ name: 'world' }, { deadline: Date.now() + 3000 }, (error, response) => {
      client.close()
      if (error)
        reject(error)
      else
        resolve(response!)
    })
  })
}

afterAll(() => new Promise<void>((resolve) => {
  upstream.closeAllConnections()
  resetting.closeAllConnections()
  h2server.close()
  grpcServer.forceShutdown()
  upstream.close(() => resetting.close(() => resolve()))
}))

function setup() {
  const state: OutboundRequestsState = { requests: {} }
  const collector = createChannelsCollector({
    getState: () => state,
  })
  return { state, collector }
}

function get(path: string) {
  return new Promise<void>((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, (response) => {
      response.resume()
      response.on('end', resolve)
    }).on('error', reject)
  })
}

describe('channels collector', () => {
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
    await get('/http')
    collector.stop()

    const timings = Object.values(state.requests)
    expect(timings).toHaveLength(1)
    expect(timings[0]!.end - timings[0]!.start).toBeGreaterThanOrEqual(30)
  })

  it('records a timing for error responses', async () => {
    const { state, collector } = setup()
    collector.start()
    await get('/missing')
    collector.stop()

    const timings = Object.values(state.requests)
    expect(timings).toHaveLength(1)
    expect(timings[0]!.end).toBeGreaterThanOrEqual(timings[0]!.start)
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
    const collector = createChannelsCollector({
      getState: () => undefined,
    })
    collector.start()
    await fetch(`http://127.0.0.1:${port}/background`)
    collector.stop()

    expect(await (await fetch(`http://127.0.0.1:${port}/still-background`)).text()).toBe('ok')
  })

  it('stops recording after stop', async () => {
    const { state, collector } = setup()
    collector.start()
    collector.stop()
    await get('/after-stop')
    await fetch(`http://127.0.0.1:${port}/after-stop-fetch`)

    expect(state.requests).toEqual({})
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

  it('records an http2 request', async () => {
    const { state, collector } = setup()
    collector.start()
    expect(await http2Request()).toBe('http2 ok')
    collector.stop()

    const timings = Object.values(state.requests)
    expect(timings).toHaveLength(1)
    expect(timings[0]!.end - timings[0]!.start).toBeGreaterThanOrEqual(30)
  })

  it('records a grpc call', async () => {
    const { state, collector } = setup()
    collector.start()
    expect(await grpcCall()).toEqual({ message: 'hello world' })
    collector.stop()

    const timings = Object.values(state.requests)
    expect(timings).toHaveLength(1)
    expect(timings[0]!.end - timings[0]!.start).toBeGreaterThanOrEqual(20)
  })

  it('attributes requests to the context that started them on reused connections', async () => {
    const contexts = new AsyncLocalStorage<OutboundRequestsState>()
    const collector = createChannelsCollector({
      getState: () => contexts.getStore(),
    })
    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 })
    const first: OutboundRequestsState = { requests: {} }
    const second: OutboundRequestsState = { requests: {} }
    collector.start()

    const request = (path: string) => new Promise<void>((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}${path}`, { agent }, (response) => {
        response.resume()
        response.on('end', resolve)
      }).on('error', reject)
    })

    await contexts.run(first, () => request('/reused-1'))
    await contexts.run(second, () => request('/reused-2'))
    collector.stop()
    agent.destroy()

    expect(Object.values(first.requests)).toHaveLength(1)
    expect(Object.values(second.requests)).toHaveLength(1)
  })
})
