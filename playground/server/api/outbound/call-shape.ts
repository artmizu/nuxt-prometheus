import http from 'node:http'
import { defineEventHandler } from 'h3'
import { useOutboundUpstreams } from '../../utils/upstreams'

interface RecordedCall {
  argCount: number
  isUrl: boolean
  marker: boolean
}

interface AppInsightsRequestOptions extends http.RequestOptions {
  disableAppInsightsAutoCollection?: boolean
}

const recorded: RecordedCall[] = []
const originalRequest = http.request

http.request = new Proxy(originalRequest, {
  apply: (target, thisArg, args) => {
    const first = args[0]
    recorded.push({
      argCount: args.length,
      isUrl: first instanceof URL,
      marker: typeof first === 'object' && first !== null && 'disableAppInsightsAutoCollection' in first
        ? Boolean(first.disableAppInsightsAutoCollection)
        : false,
    })
    return Reflect.apply(target, thisArg, args)
  },
})

function requestOptions(options: AppInsightsRequestOptions) {
  return new Promise<void>((resolve, reject) => {
    const outgoing = http.request(options, (response) => {
      response.resume()
      response.on('end', resolve)
    })
    outgoing.on('error', reject)
    outgoing.end()
  })
}

function requestUrl(url: URL, options: http.RequestOptions) {
  return new Promise<void>((resolve, reject) => {
    const outgoing = http.request(url, options, (response) => {
      response.resume()
      response.on('end', resolve)
    })
    outgoing.on('error', reject)
    outgoing.end()
  })
}

export default defineEventHandler(async () => {
  const { httpUrl } = await useOutboundUpstreams()
  const optionsFirst: AppInsightsRequestOptions = {
    host: '127.0.0.1',
    port: Number(new URL(httpUrl).port),
    path: '/options-first',
    headers: { 'x-test': '1' },
    disableAppInsightsAutoCollection: true,
  }

  const before = recorded.length
  await requestOptions(optionsFirst)
  await requestUrl(new URL(`${httpUrl}/url-first`), { method: 'GET' })

  return {
    optionsFirst: recorded[before],
    urlFirst: recorded[before + 1],
  }
})
