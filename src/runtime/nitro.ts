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

let runtimeParams: ReturnType<typeof useRuntimeConfig>['public']['prometheus']

function onRequest({ request }: { request: Request }) {
  const event = useEvent()
  const ctx = event.context.prometheus
  if (!ctx)
    return

  const url = new URL(request.url)
  const isNuxtRequest = /^\/__/.test(url.pathname)
  if (isNuxtRequest)
    return

  ctx.requests[request.url] = {
    start: Date.now(),
    end: Date.now(),
  }

  if (runtimeParams?.verbose)
    consola.info(`[nuxt-prometheus] request: ${request.url}, ${new Date().toISOString()}`)
}

function onResponse({ response }: { response: Response }) {
  const event = useEvent()
  const ctx = event.context.prometheus
  if (!ctx)
    return

  const data = ctx.requests[response.url]
  if (data)
    data.end = Date.now()
}

export default defineNitroPlugin((nitroApp) => {
  runtimeParams = useRuntimeConfig().public.prometheus

  if (!runtimeParams.enabled)
    return

  if (!runtimeParams.disableRequestInterceptor)
    interceptor.apply()

  initMetrics(runtimeParams)

  interceptor.on('request', onRequest)
  interceptor.on('response', onResponse)

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
    const path = event.context.matchedRoute?.path === '/**' ? event.context?.prometheus?.path : event.context.matchedRoute?.path
    if (!path || !event.context.prometheus)
      return

    const time = calculateTime(event.context.prometheus)

    metrics.renderTime?.labels(path).set(time.render)
    metrics.requestTime?.labels(path).set(time.request)
    metrics.totalTime?.labels(path).set(time.total)

    metrics.renderTimeSummary?.labels(path).observe(time.render)
    metrics.requestTimeSummary?.labels(path).observe(time.request)
    metrics.totalTimeSummary?.labels(path).observe(time.total)

    if (runtimeParams?.verbose) {
      consola.info(`[nuxt-prometheus] «${path}» api request time:`, time.request)
      consola.info(`[nuxt-prometheus] «${path}» render time:`, time.render)
      consola.info(`[nuxt-prometheus] «${path}» total time:`, time.total)
    }
  })

  nitroApp.hooks.hook('error', (error, _ctx) => error)
})
