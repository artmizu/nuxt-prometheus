import { defineEventHandler } from 'h3'
import { useOutboundUpstreams } from '../../utils/upstreams'

export default defineEventHandler(async () => {
  const { httpUrl } = await useOutboundUpstreams()
  const startedAt = Date.now()
  const response = await fetch(`${httpUrl}/fetch`)
  return {
    ok: response.ok,
    elapsedMs: Date.now() - startedAt,
    body: await response.json(),
  }
})
