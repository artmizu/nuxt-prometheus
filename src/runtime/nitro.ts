import { defineNitroPlugin, useRuntimeConfig } from 'nitropack/runtime'
import { BatchInterceptor } from '@mswjs/interceptors'
import { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest'
import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest'
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import consola from 'consola'
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

interceptor.apply()

export default defineNitroPlugin((nitroApp) => {
  const params = useRuntimeConfig().public.prometheus
  initMetrics(params)

  nitroApp.hooks.hook('request', (event) => {
    event.context.prometheus = {
      start: Date.now(),
      requests: {},
      onRequest({ request }: { request: Request }) {
        const url = new URL(request.url)

        /**
         * Exclude Nuxt requests to parts of the application, it's not about business-logic
         */
        const isNuxtRequest = /^\/__/.test(url.pathname)
        if (isNuxtRequest)
          return

        event.context.prometheus.requests[request.url] = {
          start: Date.now(),
          end: Date.now(),
        }

        if (params.verbose)
          consola.info(`[nuxt-prometheus] request: ${request.url}, ${new Date().toISOString()}`)
      },
      onResponse({ response }: { response: Response }) {
        if (event.context.prometheus.requests[response.url])
          event.context.prometheus.requests[response.url].end = Date.now()
      },
    }

    interceptor.on('request', event.context.prometheus.onRequest)
    interceptor.on('response', event.context.prometheus.onResponse)
  })

  /**
   * Submit a data after the response for reducing latency for the user
   * and to avoid blocking the request
   */
  nitroApp.hooks.hook('afterResponse', (event) => {
    interceptor.off('request', event.context.prometheus.onRequest)
    interceptor.off('response', event.context.prometheus.onResponse)

    const path = event.context.matchedRoute?.path === '/**' ? event.context?.prometheus?.path : event.context.matchedRoute?.path
    if (!path)
      return

    const time = calculateTime(event.context.prometheus)

    metrics.renderTime?.labels(path).set(time.render)
    metrics.requestTime?.labels(path).set(time.request)
    metrics.totalTime?.labels(path).set(time.total)

    if (params.verbose) {
      consola.info(`[nuxt-prometheus] «${path}» api request time:`, time.request)
      consola.info(`[nuxt-prometheus] «${path}» render time:`, time.render)
      consola.info(`[nuxt-prometheus] «${path}» total time:`, time.total)
    }
  })

  nitroApp.hooks.hook('error', (error, { event }) => {
    if (event?.context.prometheus.onRequest)
      interceptor.off('request', event.context.prometheus.onRequest)

    if (event?.context.prometheus.onResponse)
      interceptor.off('response', event.context.prometheus.onResponse)

    return error
  })
})
