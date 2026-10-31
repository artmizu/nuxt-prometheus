import type { NuxtPrometheusState } from './type'
import { BatchInterceptor } from '@mswjs/interceptors'
import { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest'
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest'
import consola from 'consola'
import { defineNitroPlugin, useEvent, useRuntimeConfig } from 'nitropack/runtime'
import { initMetrics, metrics } from './registry'
import { calculateTime } from './utils'

const interceptor = new BatchInterceptor({
  name: 'nuxt-prometheus',
  interceptors: [
    new XMLHttpRequestInterceptor(),
    new ClientRequestInterceptor(),
    new FetchInterceptor(),
  ],
})

const pendingRequestTimes = new WeakMap<object, { start: number, end: number }>()

function getRequestState(): NuxtPrometheusState | undefined {
  try {
    return useEvent().context.prometheus
  }
  catch {
    return undefined
  }
}

export default defineNitroPlugin((nitroApp) => {
  const params = useRuntimeConfig().public.prometheus

  if (!params.enabled)
    return

  initMetrics(params)

  if (!params.disableRequestInterceptor) {
    interceptor.apply()

    interceptor.on('request', ({ request, requestId }) => {
      const state = getRequestState()
      if (!state || /^\/__/.test(new URL(request.url).pathname))
        return

      const now = Date.now()
      const entry = { start: now, end: now }
      state.requests[requestId] = entry
      pendingRequestTimes.set(request, entry)

      if (params.verbose)
        consola.info(`[nuxt-prometheus] request: ${request.url}, ${new Date(now).toISOString()}`)
    })

    interceptor.on('response', ({ request, response }) => {
      if (response.status < 200 && response.status !== 101)
        return

      const entry = pendingRequestTimes.get(request)
      if (!entry)
        return

      entry.end = Date.now()
      pendingRequestTimes.delete(request)
    })

    nitroApp.hooks.hook('close', () => {
      interceptor.removeAllListeners()
      interceptor.dispose()
    })
  }

  nitroApp.hooks.hook('request', (event) => {
    event.context.prometheus = {
      start: Date.now(),
      requests: {},
    }
  })

  /**
   * Submit a data after the response for reducing latency for the user
   * and to avoid blocking the request
   */
  nitroApp.hooks.hook('afterResponse', (event) => {
    if (!event.context.prometheus)
      return

    const path = event.context.matchedRoute?.path === '/**'
      ? event.context?.prometheus?.path
      : event.context.matchedRoute?.path
    if (!path)
      return

    const time = calculateTime(event.context.prometheus)

    metrics.totalTime?.labels(path).set(time.total)
    metrics.totalTimeHistogram?.labels(path).observe(time.total)

    if (!params.disableRequestInterceptor) {
      metrics.renderTime?.labels(path).set(time.render)
      metrics.requestTime?.labels(path).set(time.request)
      metrics.renderTimeHistogram?.labels(path).observe(time.render)
      metrics.requestTimeHistogram?.labels(path).observe(time.request)

      if (params.verbose) {
        consola.info(`[nuxt-prometheus] «${path}» api request time:`, time.request)
        consola.info(`[nuxt-prometheus] «${path}» render time:`, time.render)
      }
    }

    if (params.verbose)
      consola.info(`[nuxt-prometheus] «${path}» total time:`, time.total)
  })
})
