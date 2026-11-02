import { Buffer } from 'node:buffer'
import { credentials, makeGenericClientConstructor, Server, ServerCredentials } from '@grpc/grpc-js'
import { defineEventHandler } from 'h3'

/**
 * Reproduction for a real gRPC call (@grpc/grpc-js over http2) with the request interceptor enabled.
 * @mswjs/interceptors 0.41.9 lets the call through, 0.42+ fails it with UNAVAILABLE or a deadline error.
 */
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

let target: Promise<string> | undefined

function startServer() {
  target ??= new Promise((resolve, reject) => {
    const server = new Server()
    server.addService(service, {
      Say: (call: any, callback: any) => callback(null, { message: `hello ${call.request.name}` }),
    })
    server.bindAsync('127.0.0.1:0', ServerCredentials.createInsecure(), (error, port) => {
      if (error)
        reject(error)
      else
        resolve(`127.0.0.1:${port}`)
    })
  })
  return target
}

export default defineEventHandler(async () => {
  const address = await startServer()
  const Client = makeGenericClientConstructor(service, 'Greeter')
  const client: any = new Client(address, credentials.createInsecure())
  const startedAt = Date.now()

  return new Promise((resolve) => {
    client.Say({ name: 'world' }, { deadline: Date.now() + 4000 }, (error: any, response: unknown) => {
      client.close()
      resolve({
        address,
        elapsedMs: Date.now() - startedAt,
        ...(error
          ? { ok: false, code: error.code, error: error.details }
          : { ok: true, response }),
      })
    })
  })
})
