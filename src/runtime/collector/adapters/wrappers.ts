import type { OutboundCollector, OutboundCollectorOptions } from '../types'
import http from 'node:http'
import http2 from 'node:http2'
import https from 'node:https'
import { createRequestTracker, isFinalStatus } from '../tracker'
import { clientRequestUrl, streamRequestUrl } from '../url'

function resolveUrl(input: RequestInfo | URL) {
  if (typeof input === 'string')
    return input
  if (input instanceof URL)
    return input.href
  return input.url
}

export function createWrappersCollector(options: OutboundCollectorOptions): OutboundCollector {
  const tracker = createRequestTracker(options)
  let restore: (() => void) | undefined

  const rethrowIfUnhandled = (target: { listenerCount: (event: string) => number }, error: unknown) => {
    if (target.listenerCount('error') === 0) {
      queueMicrotask(() => {
        throw error
      })
    }
  }

  const trackRequest = (request: http.ClientRequest, args: readonly unknown[]) => {
    tracker.begin(request, clientRequestUrl(request, args))
    request.once('response', () => tracker.settle(request))
    request.once('error', (error) => {
      tracker.settle(request)
      rethrowIfUnhandled(request, error)
    })
  }

  const trackStream = (stream: http2.ClientHttp2Stream, headers: http2.OutgoingHttpHeaders | undefined) => {
    tracker.begin(stream, streamRequestUrl(headers))
    stream.once('response', (responseHeaders) => {
      if (isFinalStatus(Number(responseHeaders[':status'])))
        tracker.settle(stream)
    })
    stream.once('error', (error) => {
      tracker.settle(stream)
      rethrowIfUnhandled(stream, error)
    })
    stream.once('close', () => tracker.settle(stream))
  }

  const trackRequestFunction = <T extends typeof http.request | typeof http.get>(target: T) => new Proxy(target, {
    apply: (target, thisArg, args) => {
      const request: http.ClientRequest = Reflect.apply(target, thisArg, args)
      trackRequest(request, args)
      return request
    },
  })

  const patchRequestModule = (module: { request: typeof http.request, get: typeof http.get }) => {
    const originalRequest = module.request
    const originalGet = module.get
    const trackedRequest = trackRequestFunction(originalRequest)
    const trackedGet = trackRequestFunction(originalGet)
    module.request = trackedRequest
    module.get = trackedGet
    return () => {
      if (module.request === trackedRequest)
        module.request = originalRequest
      if (module.get === trackedGet)
        module.get = originalGet
    }
  }

  const patchHttp2 = () => {
    const patchedSessions = new Set<() => void>()
    const originalConnect = http2.connect
    const trackedConnect = new Proxy(originalConnect, {
      apply: (target, thisArg, args) => {
        const session: http2.ClientHttp2Session = Reflect.apply(target, thisArg, args)
        const originalRequest = session.request
        const trackedRequest = new Proxy(originalRequest, {
          apply: (requestTarget, requestThisArg, requestArgs) => {
            const stream: http2.ClientHttp2Stream = Reflect.apply(requestTarget, requestThisArg, requestArgs)
            trackStream(stream, requestArgs[0])
            return stream
          },
        })
        const restoreSession = () => {
          if (session.request === trackedRequest)
            session.request = originalRequest
          patchedSessions.delete(restoreSession)
        }
        session.request = trackedRequest
        session.once('close', restoreSession)
        patchedSessions.add(restoreSession)
        return session
      },
    })
    http2.connect = trackedConnect
    return () => {
      if (http2.connect === trackedConnect)
        http2.connect = originalConnect
      for (const restoreSession of [...patchedSessions])
        restoreSession()
    }
  }

  return {
    start() {
      if (restore)
        return

      const originalFetch = globalThis.fetch
      const trackedFetch: typeof fetch = async (input, init) => {
        const key = {}
        tracker.begin(key, resolveUrl(input))
        try {
          return await originalFetch(input, init)
        }
        finally {
          tracker.settle(key)
        }
      }

      globalThis.fetch = trackedFetch
      const restoreModules = [
        patchRequestModule(http),
        patchRequestModule(https),
        patchHttp2(),
      ]

      restore = () => {
        if (globalThis.fetch === trackedFetch)
          globalThis.fetch = originalFetch
        for (const restoreModule of restoreModules)
          restoreModule()
        restore = undefined
      }
    },
    stop() {
      restore?.()
    },
  }
}
