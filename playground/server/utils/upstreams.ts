import type { handleUnaryCall, MethodDefinition } from '@grpc/grpc-js'
import { Buffer } from 'node:buffer'
import http from 'node:http'
import http2 from 'node:http2'
import { Client, credentials, Server, ServerCredentials } from '@grpc/grpc-js'

const responseDelay = 25

export interface GreeterRequest {
  name: string
}

export interface GreeterResponse {
  message: string
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value))
}

function decode(buffer: Buffer) {
  return JSON.parse(buffer.toString())
}

const sayMethod: MethodDefinition<GreeterRequest, GreeterResponse> = {
  path: '/demo.Greeter/Say',
  requestStream: false,
  responseStream: false,
  requestSerialize: encode,
  requestDeserialize: decode,
  responseSerialize: encode,
  responseDeserialize: decode,
}

const sayHandler: handleUnaryCall<GreeterRequest, GreeterResponse> = (call, callback) => {
  setTimeout(callback, responseDelay, null, { message: `hello ${call.request.name}` })
}

export interface OutboundUpstreams {
  httpUrl: string
  http2Url: string
  grpcAddress: string
}

function portOf(server: http.Server | http2.Http2Server) {
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('the upstream did not bind a TCP port')
  return address.port
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
    server.listen(0, '127.0.0.1', () => resolve({
      server,
      port: portOf(server),
    }))
  })
}

function listenHttp2() {
  const server = http2.createServer()
  server.on('stream', (stream: http2.ServerHttp2Stream) => {
    setTimeout(() => {
      stream.respond({ ':status': 200 })
      stream.end('http2 upstream')
    }, responseDelay)
  })
  return new Promise<{ server: http2.Http2Server, port: number }>((resolve, reject) => {
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => resolve({
      server,
      port: portOf(server),
    }))
  })
}

function listenGrpc() {
  const server = new Server()
  server.addService({ Say: sayMethod }, { Say: sayHandler })
  return new Promise<{ server: Server, address: string }>((resolve, reject) => {
    server.bindAsync('127.0.0.1:0', ServerCredentials.createInsecure(), (error, port) => {
      if (error)
        reject(error)
      else
        resolve({ server, address: `127.0.0.1:${port}` })
    })
  })
}

export function callGreeter(address: string, name: string) {
  const client = new Client(address, credentials.createInsecure())
  return new Promise<GreeterResponse>((resolve, reject) => {
    client.makeUnaryRequest(sayMethod.path, sayMethod.requestSerialize, sayMethod.responseDeserialize, { name }, { deadline: Date.now() + 3000 }, (error, response) => {
      client.close()
      if (error)
        reject(error)
      else if (response)
        resolve(response)
      else
        reject(new Error('the grpc call returned no response'))
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
