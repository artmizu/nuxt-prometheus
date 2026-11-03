import type { handleUnaryCall, MethodDefinition } from '@grpc/grpc-js'
import { Buffer } from 'node:buffer'
import { Client, credentials, Server, ServerCredentials } from '@grpc/grpc-js'

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

export const sayMethod: MethodDefinition<GreeterRequest, GreeterResponse> = {
  path: '/demo.Greeter/Say',
  requestStream: false,
  responseStream: false,
  requestSerialize: encode,
  requestDeserialize: decode,
  responseSerialize: encode,
  responseDeserialize: decode,
}

export function startGreeterServer(delay = 30) {
  const sayHandler: handleUnaryCall<GreeterRequest, GreeterResponse> = (call, callback) => {
    setTimeout(callback, delay, null, { message: `hello ${call.request.name}` })
  }
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

export function callGreeter(address: string) {
  const client = new Client(address, credentials.createInsecure())
  return new Promise<GreeterResponse>((resolve, reject) => {
    client.makeUnaryRequest(sayMethod.path, sayMethod.requestSerialize, sayMethod.responseDeserialize, { name: 'world' }, { deadline: Date.now() + 3000 }, (error, response) => {
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
