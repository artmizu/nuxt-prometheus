import { Buffer } from 'node:buffer'
import http from 'node:http'
import http2 from 'node:http2'
import { credentials, makeGenericClientConstructor, Server, ServerCredentials } from '@grpc/grpc-js'

const responseDelay = 25

const serialize = (value: unknown) => Buffer.from(JSON.stringify(value))
const deserialize = (buffer: Buffer) => JSON.parse(buffer.toString())

const greeterService = {
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

export interface OutboundUpstreams {
  httpUrl: string
  http2Url: string
  grpcAddress: string
}

export interface GreeterClient {
  Say: (
    request: { name: string },
    options: { deadline: number },
    callback: (error: { code?: number, details?: string } | null, response?: { message: string }) => void,
  ) => void
  close: () => void
}

export function createGreeterClient(address: string): GreeterClient {
  const Client = makeGenericClientConstructor(greeterService, 'Greeter')
  return new Client(address, credentials.createInsecure()) as unknown as GreeterClient
}

function listenHttp() {
  const server = http.createServer((request, response) => {
    setTimeout(() => {
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ message: 'http upstream', path: request.url }))
    }, responseDelay)
  })
  return new Promise<{ server: http.Server, port: number }>((resolve, reject) => {
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => resolve({ server, port: (server.address() as { port: number }).port }))
  })
}

function listenHttp2() {
  const server = http2.createServer()
  server.on('stream', (stream) => {
    setTimeout(() => {
      stream.respond({ ':status': 200 })
      stream.end('http2 upstream')
    }, responseDelay)
  })
  return new Promise<{ server: http2.Http2Server, port: number }>((resolve, reject) => {
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => resolve({ server, port: (server.address() as { port: number }).port }))
  })
}

function listenGrpc() {
  const server = new Server()
  server.addService(greeterService, {
    Say: (call: { request: { name: string } }, callback: (error: null, response: { message: string }) => void) => {
      setTimeout(callback, responseDelay, null, { message: `hello ${call.request.name}` })
    },
  } as never)
  return new Promise<{ server: Server, address: string }>((resolve, reject) => {
    server.bindAsync('127.0.0.1:0', ServerCredentials.createInsecure(), (error, port) => {
      if (error)
        reject(error)
      else
        resolve({ server, address: `127.0.0.1:${port}` })
    })
  })
}

let upstreams: Promise<OutboundUpstreams> | undefined

export function useOutboundUpstreams() {
  upstreams ??= Promise.all([
    listenHttp(),
    listenHttp2(),
    listenGrpc(),
  ]).then(([httpUpstream, http2Upstream, grpcUpstream]) => ({
    httpUrl: `http://127.0.0.1:${httpUpstream.port}`,
    http2Url: `http://127.0.0.1:${http2Upstream.port}`,
    grpcAddress: grpcUpstream.address,
  }))
  return upstreams
}
