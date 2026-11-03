import type { NuxtPrometheusState } from './type'
import consola from 'consola'
import { defineNitroPlugin, useEvent, useRuntimeConfig } from 'nitropack/runtime'
import { createOutboundCollector } from './collector'
import { initMetrics, metrics } from './registry'
import { calculateTime, resolveResponseStatus } from './utils'

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
    const collector = createOutboundCollector({
      getState: getRequestState,
      onRequest: params.verbose
        ? (url, startedAt) => consola.info(`[nuxt-prometheus] request: ${url}, ${new Date(startedAt).toISOString()}`)
        : undefined,
    })

    collector.start()

    nitroApp.hooks.hook('close', () => {
      collector.stop()
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
    const statusCode = resolveResponseStatus(event, path)

    metrics.totalTime?.labels(path, statusCode).set(time.total)
    metrics.totalTimeHistogram?.labels(path, statusCode).observe(time.total)

    if (!params.disableRequestInterceptor) {
      metrics.renderTime?.labels(path, statusCode).set(time.render)
      metrics.requestTime?.labels(path, statusCode).set(time.request)
      metrics.renderTimeHistogram?.labels(path, statusCode).observe(time.render)
      metrics.requestTimeHistogram?.labels(path, statusCode).observe(time.request)

      if (params.verbose) {
        consola.info(`[nuxt-prometheus] «${path}» api request time:`, time.request)
        consola.info(`[nuxt-prometheus] «${path}» render time:`, time.render)
      }
    }

    if (params.verbose)
      consola.info(`[nuxt-prometheus] «${path}» total time:`, time.total)
  })
})
