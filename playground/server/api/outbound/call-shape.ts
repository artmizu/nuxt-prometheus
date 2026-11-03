import type { ClientRequest } from 'node:http'
import http from 'node:http'
import { defineEventHandler } from 'h3'
import { useOutboundUpstreams } from '../../utils/upstreams'

interface RecordedCall {
  argCount: number
  isUrl: boolean
  marker: boolean
}

const recorded: RecordedCall[] = []
const originalRequest = http.request

http.request = function recordingRequest(this: unknown, ...args: unknown[]) {
  const first = args[0]
  recorded.push({
    argCount: args.length,
    isUrl: first instanceof URL,
    marker: typeof first === 'object' && first !== null && 'disableAppInsightsAutoCollection' in first
      ? Boolean((first as Record<string, unknown>).disableAppInsightsAutoCollection)
      : false,
  })
  return (originalRequest as unknown as (...args: unknown[]) => ClientRequest).apply(this, args)
} as typeof http.request

function request(target: string | URL | http.RequestOptions, options?: http.RequestOptions) {
  return new Promise<void>((resolve, reject) => {
    const onResponse = (response: http.IncomingMessage) => {
      response.resume()
      response.on('end', resolve)
    }
    const outgoing = options
      ? http.request(target as string | URL, options, onResponse)
      : http.request(target as string | URL, onResponse)
    outgoing.on('error', reject)
    outgoing.end()
  })
}

export default defineEventHandler(async () => {
  const { httpUrl } = await useOutboundUpstreams()
  const optionsFirst = {
    host: '127.0.0.1',
    port: Number(new URL(httpUrl).port),
    path: '/options-first',
    headers: { 'x-test': '1' },
    disableAppInsightsAutoCollection: true,
  }

  const before = recorded.length
  await request(optionsFirst)
  await request(new URL(`${httpUrl}/url-first`), { method: 'GET' })

  return {
    optionsFirst: recorded[before],
    urlFirst: recorded[before + 1],
  }
})
