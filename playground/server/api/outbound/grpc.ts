import { defineEventHandler } from 'h3'
import { createGreeterClient, useOutboundUpstreams } from '../../utils/upstreams'

export default defineEventHandler(async () => {
  const { grpcAddress } = await useOutboundUpstreams()
  const client = createGreeterClient(grpcAddress)
  const startedAt = Date.now()
  try {
    const response = await new Promise<{ message: string }>((resolve, reject) => {
      client.Say({ name: 'world' }, { deadline: Date.now() + 3000 }, (error, response) => {
        if (error)
          reject(error)
        else
          resolve(response!)
      })
    })
    return { ok: true, elapsedMs: Date.now() - startedAt, response }
  }
  catch (error) {
    const failure = error as { code?: number, details?: string }
    return { ok: false, code: failure.code, error: failure.details ?? String(error) }
  }
  finally {
    client.close()
  }
})
