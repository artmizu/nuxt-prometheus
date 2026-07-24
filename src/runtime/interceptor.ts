import type { NuxtPrometheusState } from './type'
import { AsyncLocalStorage } from 'node:async_hooks'
import { BatchInterceptor } from '@mswjs/interceptors'
import { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest'
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest'
import consola from 'consola'

export const interceptor = new BatchInterceptor({
  name: 'nuxt-prometheus',
  interceptors: [
    new XMLHttpRequestInterceptor(),
    new ClientRequestInterceptor(),
    new FetchInterceptor(),
  ],
})

export const requestContext = new AsyncLocalStorage<NuxtPrometheusState>()

let resolveState: () => NuxtPrometheusState | undefined = () => requestContext.getStore()

export function setStateResolver(resolver: () => NuxtPrometheusState | undefined): void {
  resolveState = resolver
}

function isNuxtInternalRequest(url: string): boolean {
  try {
    return /^\/__/.test(new URL(url).pathname)
  }
  catch {
    return false
  }
}

let listenersBound = false

// Bind a single listener pair for the process lifetime; the old code attached a
// fresh pair per request and leaked them when cleanup hooks did not fire.
export function bindInterceptor({ verbose = false }: { verbose?: boolean } = {}): void {
  if (listenersBound)
    return
  listenersBound = true

  interceptor.on('request', ({ request }: { request: Request }) => {
    const state = resolveState()
    if (!state)
      return

    if (isNuxtInternalRequest(request.url))
      return

    const now = Date.now()
    state.requests[request.url] = { start: now, end: now }

    if (verbose)
      consola.info(`[nuxt-prometheus] request: ${request.url}, ${new Date(now).toISOString()}`)
  })

  interceptor.on('response', ({ response }: { response: Response }) => {
    const state = resolveState()
    if (!state)
      return

    const data = state.requests[response.url]
    if (data)
      data.end = Date.now()
  })
}

// Total listeners across the batched interceptors, for the leak tests.
export function interceptorListenerCount(event: 'request' | 'response'): number {
  const children = (interceptor as unknown as { interceptors: Array<{ emitter: { listenerCount: (e: string) => number } }> }).interceptors
  return children.reduce((total, child) => total + child.emitter.listenerCount(event), 0)
}

export function resetInterceptorForTests(): void {
  interceptor.removeAllListeners('request')
  interceptor.removeAllListeners('response')
  listenersBound = false
  resolveState = () => requestContext.getStore()
}
