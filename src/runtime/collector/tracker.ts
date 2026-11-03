import type { OutboundCollectorOptions, OutboundRequestTiming } from './types'

let nextRequestId = 0

function isInternalUrl(url: string) {
  if (url.startsWith('/__'))
    return true
  try {
    return new URL(url).pathname.startsWith('/__')
  }
  catch {
    return false
  }
}

export function isFinalStatus(statusCode: number | undefined) {
  return (statusCode ?? 0) >= 200 || statusCode === 101
}

export function createRequestTracker(options: OutboundCollectorOptions) {
  const pending = new WeakMap<object, OutboundRequestTiming>()

  return {
    begin(request: object, url: string) {
      const state = options.getState()
      if (!state || isInternalUrl(url))
        return
      const startedAt = Date.now()
      const timing = { start: startedAt, end: startedAt }
      state.requests[String(nextRequestId++)] = timing
      pending.set(request, timing)
      options.onRequest?.(url, startedAt)
    },
    settle(request: object) {
      const timing = pending.get(request)
      if (!timing)
        return
      timing.end = Date.now()
      pending.delete(request)
    },
  }
}
