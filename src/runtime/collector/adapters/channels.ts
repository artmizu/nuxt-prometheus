import type { IncomingHttpHeaders, OutgoingHttpHeaders } from 'node:http2'
import type { OutboundCollector, OutboundCollectorOptions } from '../types'
import diagnosticsChannel from 'node:diagnostics_channel'
import { createRequestTracker, isFinalStatus } from '../tracker'
import { clientRequestUrl, streamRequestUrl } from '../url'

interface FetchRequestMessage {
  request: { origin?: string, path?: string }
}

interface FetchResponseMessage {
  request: object
  response?: { statusCode?: number }
}

interface HttpClientRequestMessage {
  request: { protocol?: string, host?: string, path?: string, getHeader?: (name: string) => unknown }
}

interface HttpClientResponseMessage {
  request: object
  response?: { statusCode?: number }
}

interface Http2StreamMessage {
  stream: object
}

interface Http2StreamCreatedMessage extends Http2StreamMessage {
  headers: OutgoingHttpHeaders
}

interface Http2StreamFinishedMessage extends Http2StreamMessage {
  headers: IncomingHttpHeaders
}

interface ChannelSubscription {
  start: () => void
  stop: () => void
}

function channelSubscription<T>(channel: string, listener: (message: T) => void): ChannelSubscription {
  const channelListener = (message: unknown) => listener(message as T)
  return {
    start: () => diagnosticsChannel.subscribe(channel, channelListener),
    stop: () => diagnosticsChannel.unsubscribe(channel, channelListener),
  }
}

export function createChannelsCollector(options: OutboundCollectorOptions): OutboundCollector {
  const tracker = createRequestTracker(options)

  const subscriptions = [
    channelSubscription<FetchRequestMessage>('undici:request:create', ({ request }) => {
      tracker.begin(request, `${request.origin ?? ''}${request.path ?? ''}`)
    }),
    channelSubscription<FetchResponseMessage>('undici:request:headers', ({ request, response }) => {
      if (isFinalStatus(response?.statusCode))
        tracker.settle(request)
    }),
    channelSubscription<FetchResponseMessage>('undici:request:error', ({ request }) => {
      tracker.settle(request)
    }),
    channelSubscription<HttpClientRequestMessage>('http.client.request.created', ({ request }) => {
      tracker.begin(request, clientRequestUrl(request))
    }),
    channelSubscription<HttpClientResponseMessage>('http.client.response.finish', ({ request, response }) => {
      if (isFinalStatus(response?.statusCode))
        tracker.settle(request)
    }),
    channelSubscription<HttpClientRequestMessage>('http.client.request.error', ({ request }) => {
      tracker.settle(request)
    }),
    channelSubscription<Http2StreamCreatedMessage>('http2.client.stream.created', ({ stream, headers }) => {
      tracker.begin(stream, streamRequestUrl(headers))
    }),
    channelSubscription<Http2StreamFinishedMessage>('http2.client.stream.finish', ({ stream, headers }) => {
      if (isFinalStatus(Number(headers[':status'])))
        tracker.settle(stream)
    }),
    channelSubscription<Http2StreamMessage>('http2.client.stream.error', ({ stream }) => {
      tracker.settle(stream)
    }),
    channelSubscription<Http2StreamMessage>('http2.client.stream.close', ({ stream }) => {
      tracker.settle(stream)
    }),
  ]

  let started = false

  return {
    start() {
      if (started)
        return
      started = true
      for (const subscription of subscriptions)
        subscription.start()
    },
    stop() {
      if (!started)
        return
      started = false
      for (const subscription of subscriptions)
        subscription.stop()
    },
  }
}
