import { defineEventHandler } from 'h3'
import { callGreeter, useOutboundUpstreams } from '../../utils/upstreams'

function errorCode(error: unknown) {
  if (!(error instanceof Error) || !('code' in error) || typeof error.code !== 'number')
    return undefined
  return error.code
}

function errorMessage(error: unknown) {
  if (!(error instanceof Error))
    return String(error)
  if ('details' in error && typeof error.details === 'string')
    return error.details
  return error.message
}

export default defineEventHandler(async () => {
  const { grpcAddress } = await useOutboundUpstreams()
  const startedAt = Date.now()
  try {
    const response = await callGreeter(grpcAddress, 'world')
    return { ok: true, elapsedMs: Date.now() - startedAt, response }
  }
  catch (error) {
    return {
      ok: false,
      code: errorCode(error),
      error: errorMessage(error),
    }
  }
})
