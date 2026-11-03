import type { OutboundCollector, OutboundCollectorOptions } from '../types'
import diagnosticsChannel from 'node:diagnostics_channel'
import { createRequestTracker, isFinalStatus } from '../tracker'

interface FetchRequestMessage {
  request: { origin?: string, path?: string }
}

interface FetchHeadersMessage {
  request: object
  response?: { statusCode?: number }
}

interface HttpClientRequestMessage {
  request: { protocol?: string, host?: string, path?: string }
}

interface HttpClientResponseMessage {
  request: object
  response?: { statusCode?: number }
}

interface Http2StreamMessage {
  stream: object
  headers?: Record<string, string | number | undefined>
}

function httpRequestUrl(request: HttpClientRequestMessage['request']) {
  return `${request.protocol ?? 'http:'}//${request.host ?? 'localhost'}${request.path ?? ''}`
}

function http2RequestUrl(headers: Http2StreamMessage['headers']) {
  return `${headers?.[':scheme'] ?? 'http'}://${headers?.[':authority'] ?? 'localhost'}${headers?.[':path'] ?? ''}`
}

export function createChannelsCollector(options: OutboundCollectorOptions): OutboundCollector {
  const tracker = createRequestTracker(options)
  let started = false

  const onFetchStart = (message: unknown) => {
    const { request } = message as FetchRequestMessage
    tracker.begin(request, `${request.origin ?? ''}${request.path ?? ''}`)
  }

  const onFetchHeaders = (message: unknown) => {
    const { request, response } = message as FetchHeadersMessage
    if (isFinalStatus(response?.statusCode))
      tracker.settle(request)
  }

  const onFetchError = (message: unknown) => {
    tracker.settle((message as FetchHeadersMessage).request)
  }

  const onHttpStart = (message: unknown) => {
    const { request } = message as HttpClientRequestMessage
    tracker.begin(request, httpRequestUrl(request))
  }

  const onHttpFinish = (message: unknown) => {
    const { request, response } = message as HttpClientResponseMessage
    if (isFinalStatus(response?.statusCode))
      tracker.settle(request)
  }

  const onHttpError = (message: unknown) => {
    tracker.settle((message as HttpClientRequestMessage).request)
  }

  const onHttp2Start = (message: unknown) => {
    const { stream, headers } = message as Http2StreamMessage
    tracker.begin(stream, http2RequestUrl(headers))
  }

  const onHttp2Finish = (message: unknown) => {
    const { stream, headers } = message as Http2StreamMessage
    if (isFinalStatus(Number(headers?.[':status'])))
      tracker.settle(stream)
  }

  const onHttp2Error = (message: unknown) => {
    tracker.settle((message as Http2StreamMessage).stream)
  }

  const onHttp2Close = (message: unknown) => {
    tracker.settle((message as Http2StreamMessage).stream)
  }

  const subscriptions = [
    ['undici:request:create', onFetchStart],
    ['undici:request:headers', onFetchHeaders],
    ['undici:request:error', onFetchError],
    ['http.client.request.created', onHttpStart],
    ['http.client.response.finish', onHttpFinish],
    ['http.client.request.error', onHttpError],
    ['http2.client.stream.created', onHttp2Start],
    ['http2.client.stream.finish', onHttp2Finish],
    ['http2.client.stream.error', onHttp2Error],
    ['http2.client.stream.close', onHttp2Close],
  ] as const

  return {
    start() {
      if (started)
        return
      started = true
      for (const [name, listener] of subscriptions)
        diagnosticsChannel.subscribe(name, listener)
    },
    stop() {
      if (!started)
        return
      started = false
      for (const [name, listener] of subscriptions)
        diagnosticsChannel.unsubscribe(name, listener)
    },
  }
}
