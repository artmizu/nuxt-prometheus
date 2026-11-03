import type { OutboundCollector, OutboundCollectorOptions } from '../types'
import http from 'node:http'
import https from 'node:https'
import { createRequestTracker } from '../tracker'

type RequestFunction = (this: unknown, ...args: never[]) => unknown

interface ClientRequestLike {
  protocol?: string
  host?: string
  path?: string
  once: (event: string, listener: () => void) => unknown
}

function resolveUrl(input: unknown) {
  if (typeof input === 'string')
    return input
  if (input instanceof URL)
    return input.href
  if (input && typeof input === 'object') {
    const candidate = input as { url?: string, href?: string, path?: string }
    return candidate.url ?? candidate.href ?? candidate.path ?? ''
  }
  return ''
}

function patchRequestModule<T extends RequestFunction>(
  module: { request: T, get: T },
  track: (original: T) => T,
) {
  const originalRequest = module.request
  const originalGet = module.get
  const trackedRequest = track(originalRequest)
  const trackedGet = track(originalGet)
  module.request = trackedRequest
  module.get = trackedGet
  return () => {
    if (module.request === trackedRequest)
      module.request = originalRequest
    if (module.get === trackedGet)
      module.get = originalGet
  }
}

export function createWrappersCollector(options: OutboundCollectorOptions): OutboundCollector {
  const tracker = createRequestTracker(options)
  let restore: (() => void) | undefined

  const trackRequest = <T extends RequestFunction>(original: T): T => {
    const tracked = function trackedRequest(this: unknown, ...args: Parameters<T>) {
      const request = Reflect.apply(original, this, args) as ClientRequestLike
      if (typeof request?.once !== 'function')
        return request

      tracker.begin(request, `${request.protocol ?? 'http:'}//${request.host ?? 'localhost'}${request.path ?? ''}`)
      request.once('response', () => tracker.settle(request))
      request.once('error', () => tracker.settle(request))
      return request
    }
    return tracked as unknown as T
  }

  return {
    start() {
      if (restore)
        return

      const originalFetch = globalThis.fetch
      const trackedFetch = async function trackedFetch(this: unknown, input: unknown, init?: RequestInit) {
        const key = {}
        tracker.begin(key, resolveUrl(input))
        try {
          const response = await originalFetch.call(this, input as RequestInfo, init)
          tracker.settle(key)
          return response
        }
        catch (error) {
          tracker.settle(key)
          throw error
        }
      }

      globalThis.fetch = trackedFetch
      const restoreModules = [
        patchRequestModule(http, trackRequest),
        patchRequestModule(https, trackRequest),
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
